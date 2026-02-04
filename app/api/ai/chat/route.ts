/**
 * AI Chat Backend Controller
 * POST /api/ai/chat
 * 
 * รับข้อความจากผู้ใช้ ประมวลผล และตอบกลับด้วยข้อมูลจริงจากระบบ
 * 
 * Enhanced with:
 * - Reasoning Engine (Phase 8)
 * - Safety Guardrails (Phase 9)
 * - Audit Logging
 */

import { NextRequest, NextResponse } from 'next/server';
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
  getLogStats,
} from '@/lib/ai/guardrails';
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
}

async function _POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  const startTime = Date.now();
  let userRole = 'viewer';
  let detectedTools: string[] = [];
  
  try {
    const body: AIChatRequest = await request.json();
    const { message, conversation_history, session_id, user_id, enable_analysis = true } = body;
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
    
    // Log interaction start
    console.log(`[AI Chat] User message: "${userMessage.substring(0, 100)}..." | Role: ${userRole}`);

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
      
      // Log greeting interaction
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

    // === CHECK FOR UNANSWERABLE QUESTIONS (Phase 11) ===
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

      console.log(`[AI Chat] Unanswerable question detected: ${unanswerableCheck.intent}`);

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

    // Use only allowed tools
    const allowedTools = guardrailResult.allowedTools;

    // If no tools detected, provide a helpful response
    if (allowedTools.length === 0) {
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
      
      // Add default limit if not specified
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
        // Count data points
        if (data?.data && Array.isArray(data.data)) {
          totalDataPoints += data.data.length;
        }
        
        // Format the response with reasoning if enabled
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

    const processingTime = Date.now() - startTime;
    const finalResponse = combinedResponse.trim();
    
    // Calculate token usage
    const tokenUsage = calculateTokenUsage(userMessage, finalResponse);
    
    // Log successful interaction
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

    console.log(`[AI Chat] Response generated in ${processingTime}ms | Tokens: ~${tokenUsage.totalTokens} | Data points: ${totalDataPoints}`);

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
 * Get base URL from request
 * Handles various deployment scenarios including localhost, Vercel, and custom domains
 */
function getBaseUrl(request: NextRequest): string {
  // Try to get from environment first
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Try to construct from request headers
  const host = request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  
  // Use forwarded host if available (for proxied requests)
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
    version: '1.0',
    timestamp: new Date().toISOString(),
  });
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);
