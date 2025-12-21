/**
 * Scenario Templates API
 * GET /api/ai/simulation/templates
 * 
 * Returns pre-built scenario templates for common what-if analyses
 */

import { NextResponse } from 'next/server';
import { SCENARIO_TEMPLATES } from '@/lib/simulation';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      templates: SCENARIO_TEMPLATES.map((template) => ({
        id: template.id,
        name: template.name,
        name_th: template.name_th,
        description: template.description,
        description_th: template.description_th,
        scenario_type: template.scenario_type,
        default_parameters: template.default_parameters,
        typical_use_case: template.typical_use_case,
        typical_use_case_th: template.typical_use_case_th,
      })),
      total: SCENARIO_TEMPLATES.length,
    },
    metadata: {
      description: 'Pre-built scenario templates for common what-if analyses',
      usage: 'Select a template and optionally modify parameters before running simulation',
    },
  });
}
