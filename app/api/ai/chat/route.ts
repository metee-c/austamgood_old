/**
 * AI Chat Backend Controller
 * POST /api/ai/chat
 *
 * รับข้อความจากผู้ใช้ ประมวลผล และตอบกลับด้วยข้อมูลจริงจากระบบ
 *
 * Modes:
 * - With api_key: calls Claude claude-sonnet-4-6 with real DB data as context → intelligent answer
 * - Without api_key: rule-based intent detection + formatResponse (legacy)
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  ChatRequest,
  ChatResponse,
  detectIntent,
  detectUnanswerableIntent,
  executeTool,
  formatResponse,
  generateGreeting,
  ToolResult,
} from '@/lib/ai/chat-service';
import {
  performGuardrailCheck,
  logInteraction,
  calculateTokenUsage,
  SAFE_RESPONSES,
} from '@/lib/ai/guardrails';
import { WMS_AI_SYSTEM_PROMPT } from '@/lib/ai/system-prompt';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export interface AIChatRequest {
  message: string;
  conversation_history?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  session_id?: string;
  user_id?: string;
  user_role?: string;
  enable_analysis?: boolean;
  /** Anthropic API key — when provided, Claude synthesizes the final answer */
  api_key?: string;
}

async function _POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  const startTime = Date.now();
  let userRole = 'viewer';
  let detectedTools: string[] = [];

  try {
    const body: AIChatRequest = await request.json();
    const {
      message,
      conversation_history,
      session_id,
      user_id,
      enable_analysis = true,
      api_key,
    } = body;
    userRole = body.user_role || 'viewer';

    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({
        success: false,
        message: 'กรุณาพิมพ์ข้อความ',
        error: 'Message is required',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const userMessage = message.trim();

    console.log(`[AI Chat] User message: "${userMessage.substring(0, 100)}..." | Role: ${userRole} | Claude: ${api_key ? 'yes' : 'no'}`);

    // Check for greeting/help messages
    const lowerMessage = userMessage.toLowerCase();
    if (
      lowerMessage === 'สวัสดี' ||
      lowerMessage === 'hello' ||
      lowerMessage === 'hi' ||
      lowerMessage === 'help' ||
      lowerMessage === 'ช่วย' ||
      lowerMessage === 'ช่วยด้วย' ||
      lowerMessage === 'ทำอะไรได้บ้าง'
    ) {
      const processingTime = Date.now() - startTime;

      logInteraction({
        timestamp: new Date().toISOString(),
        session_id,
        user_id,
        user_role: userRole,
        message: userMessage,
        intent_detected: ['greeting'],
        tools_called: [],
        response_length: SAFE_RESPONSES.greeting.length,
        data_points_used: 0,
        processing_time_ms: processingTime,
        success: true,
      });

      return NextResponse.json({
        success: true,
        message: generateGreeting(),
        timestamp: new Date().toISOString(),
      });
    }

    // Detect intent and determine which tools to call
    const { tools, params } = detectIntent(userMessage);
    detectedTools = tools;

    console.log(`[AI Chat] Detected tools: ${tools.join(', ') || 'none'}`);

    // === CHECK FOR UNANSWERABLE QUESTIONS ===
    const unanswerableCheck = detectUnanswerableIntent(userMessage);
    if (unanswerableCheck.isUnanswerable && unanswerableCheck.guidance) {
      const processingTime = Date.now() - startTime;

      logInteraction({
        timestamp: new Date().toISOString(),
        session_id,
        user_id,
        user_role: userRole,
        message: userMessage,
        intent_detected: [unanswerableCheck.intent || 'unanswerable'],
        tools_called: [],
        response_length: unanswerableCheck.guidance.length,
        data_points_used: 0,
        processing_time_ms: processingTime,
        success: true,
      });

      return NextResponse.json({
        success: true,
        message: unanswerableCheck.guidance,
        timestamp: new Date().toISOString(),
      });
    }

    // === GUARDRAIL CHECK ===
    const guardrailResult = performGuardrailCheck(userMessage, userRole, tools);

    if (!guardrailResult.passed) {
      const processingTime = Date.now() - startTime;

      logInteraction({
        timestamp: new Date().toISOString(),
        session_id,
        user_id,
        user_role: userRole,
        message: userMessage,
        intent_detected: tools,
        tools_called: [],
        response_length: guardrailResult.message?.length || 0,
        data_points_used: 0,
        processing_time_ms: processingTime,
        success: false,
        error: 'Guardrail check failed',
      });

      return NextResponse.json({
        success: false,
        message: guardrailResult.message || SAFE_RESPONSES.error,
        error: 'Guardrail check failed',
        timestamp: new Date().toISOString(),
      }, { status: 403 });
    }

    const allowedTools = guardrailResult.allowedTools;

    // If no tools detected, ask Claude for a general WMS answer (or fallback)
    if (allowedTools.length === 0) {
      if (api_key) {
        // Let Claude answer open-ended questions with the system prompt
        try {
          const finalResponse = await callClaudeWithContext(
            api_key,
            userMessage,
            [],
            conversation_history,
          );
          const processingTime = Date.now() - startTime;
          logInteraction({
            timestamp: new Date().toISOString(),
            session_id,
            user_id,
            user_role: userRole,
            message: userMessage,
            intent_detected: tools,
            tools_called: [],
            response_length: finalResponse.length,
            data_points_used: 0,
            processing_time_ms: processingTime,
            success: true,
          });
          return NextResponse.json({
            success: true,
            message: finalResponse,
            timestamp: new Date().toISOString(),
          });
        } catch (claudeErr) {
          console.error('[AI Chat] Claude error (no tools):', claudeErr);
        }
      }

      const processingTime = Date.now() - startTime;
      logInteraction({
        timestamp: new Date().toISOString(),
        session_id,
        user_id,
        user_role: userRole,
        message: userMessage,
        intent_detected: tools,
        tools_called: [],
        response_length: SAFE_RESPONSES.outOfScope.length,
        data_points_used: 0,
        processing_time_ms: processingTime,
        success: true,
      });

      return NextResponse.json({
        success: true,
        message: SAFE_RESPONSES.outOfScope,
        timestamp: new Date().toISOString(),
      });
    }

    // Get base URL for API calls
    const baseUrl = getBaseUrl(request);

    // Execute tools and collect results
    const toolResults: ToolResult[] = [];
    let combinedResponse = '';
    let totalDataPoints = 0;

    for (const toolName of allowedTools) {
      const toolParams = { ...params };

      if (!toolParams.limit) {
        toolParams.limit = 50;
      }

      console.log(`[AI Chat] Executing tool: ${toolName}`);

      const { data, error } = await executeTool(toolName, toolParams, baseUrl);

      toolResults.push({
        tool_call_id: `${toolName}_${Date.now()}`,
        name: toolName,
        result: data,
        error,
      });

      if (error) {
        console.error(`[AI Chat] Tool error for ${toolName}:`, error);
        combinedResponse += `\n\n⚠️ ไม่สามารถดึงข้อมูลจาก ${toolName} ได้: ${error}`;
      } else {
        if (data?.data && Array.isArray(data.data)) {
          totalDataPoints += data.data.length;
        }

        // Rule-based formatted response (used as fallback or without api_key)
        const formattedResponse = formatResponse(toolName, data, userMessage, enable_analysis);
        combinedResponse += (combinedResponse ? '\n\n---\n\n' : '') + formattedResponse;
      }
    }

    // Add guardrail warnings if any
    if (guardrailResult.warnings.length > 0) {
      combinedResponse += '\n\n' + guardrailResult.warnings.map(w => `_${w}_`).join('\n');
    }

    // If all tools failed, return error
    if (toolResults.every(r => r.error)) {
      const processingTime = Date.now() - startTime;

      logInteraction({
        timestamp: new Date().toISOString(),
        session_id,
        user_id,
        user_role: userRole,
        message: userMessage,
        intent_detected: tools,
        tools_called: allowedTools,
        response_length: 0,
        data_points_used: 0,
        processing_time_ms: processingTime,
        success: false,
        error: 'All tool calls failed',
      });

      return NextResponse.json({
        success: false,
        message: SAFE_RESPONSES.error,
        tool_results: toolResults,
        error: 'All tool calls failed',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    // === CLAUDE SYNTHESIS (when api_key provided) ===
    // Replace rule-based combinedResponse with Claude's intelligent synthesis
    if (api_key) {
      try {
        const successfulResults = toolResults.filter(r => !r.error);
        const claudeResponse = await callClaudeWithContext(
          api_key,
          userMessage,
          successfulResults,
          conversation_history,
        );
        combinedResponse = claudeResponse;
        console.log('[AI Chat] Claude synthesis successful');
      } catch (claudeErr) {
        // If Claude fails, fall through to rule-based combinedResponse
        console.error('[AI Chat] Claude synthesis failed, using rule-based response:', claudeErr);
      }
    }

    const processingTime = Date.now() - startTime;
    const finalResponse = combinedResponse.trim();

    const tokenUsage = calculateTokenUsage(userMessage, finalResponse);

    logInteraction({
      timestamp: new Date().toISOString(),
      session_id,
      user_id,
      user_role: userRole,
      message: userMessage,
      intent_detected: tools,
      tools_called: allowedTools,
      response_length: finalResponse.length,
      data_points_used: totalDataPoints,
      processing_time_ms: processingTime,
      success: true,
    });

    console.log(`[AI Chat] Response in ${processingTime}ms | Tokens: ~${tokenUsage.totalTokens} | Data: ${totalDataPoints}`);

    return NextResponse.json({
      success: true,
      message: finalResponse,
      tool_calls: allowedTools.map((t, i) => ({
        id: `${t}_${Date.now()}_${i}`,
        name: t,
        arguments: params,
      })),
      tool_results: toolResults,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[AI Chat] Unexpected error:', error);

    const processingTime = Date.now() - startTime;

    logInteraction({
      timestamp: new Date().toISOString(),
      user_role: userRole,
      message: 'Error occurred',
      intent_detected: detectedTools,
      tools_called: [],
      response_length: 0,
      data_points_used: 0,
      processing_time_ms: processingTime,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json({
      success: false,
      message: SAFE_RESPONSES.error,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * Call Claude claude-sonnet-4-6 with WMS system prompt + real tool data as context.
 * Produces an intelligent, natural-language answer in Thai.
 */
async function callClaudeWithContext(
  apiKey: string,
  userMessage: string,
  toolResults: ToolResult[],
  conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  // Build the user turn: include tool data as context
  let contextBlock = '';
  if (toolResults.length > 0) {
    const sections = toolResults.map(r => {
      const dataStr = typeof r.result === 'object'
        ? JSON.stringify(r.result, null, 2)
        : String(r.result ?? '');
      // Truncate very large payloads to avoid exceeding token limits
      const truncated = dataStr.length > 8000
        ? dataStr.substring(0, 8000) + '\n... (ข้อมูลถูกตัดทอน)'
        : dataStr;
      return `### ข้อมูลจาก ${r.name}:\n${truncated}`;
    });
    contextBlock = `\n\nข้อมูลจากระบบ WMS ที่ดึงมาเพื่อตอบคำถามนี้:\n\n${sections.join('\n\n')}`;
  }

  const userTurn = toolResults.length > 0
    ? `คำถาม: ${userMessage}${contextBlock}\n\nกรุณาตอบเป็นภาษาไทย กระชับ ตรงประเด็น ไม่เกิน 200 คำ ใช้ตารางหรือรายการเมื่อมีหลายรายการ ห้ามอธิบายข้อจำกัดยาวๆ`
    : userMessage;

  // Build conversation messages for Claude
  const messages: Anthropic.MessageParam[] = [];

  // Include recent conversation history (last 6 turns max)
  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory
      .filter(m => m.role !== 'system')
      .slice(-6);
    for (const m of recentHistory) {
      messages.push({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      });
    }
  }

  messages.push({ role: 'user', content: userTurn });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: WMS_AI_SYSTEM_PROMPT,
    messages,
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock ? (textBlock as Anthropic.TextBlock).text : '';
}

/**
 * Get base URL from request headers
 */
function getBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  const host = request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');

  const effectiveHost = forwardedHost || host || 'localhost:3000';
  const protocol = forwardedProto || (effectiveHost.includes('localhost') ? 'http' : 'https');

  return `${protocol}://${effectiveHost}`;
}

/**
 * GET endpoint for health check
 */
async function _GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'AI Chat',
    version: '2.0',
    timestamp: new Date().toISOString(),
  });
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);
