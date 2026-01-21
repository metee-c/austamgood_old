import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * API for SKU preparation area mapping
 * Used to validate transfers to picking homes
 *
 * Query params:
 * - location_code: Check if this location code exists in preparation_area table
 *                  and which SKUs are mapped to it
 * - sku_id: Get the designated picking home for a specific SKU
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = createServiceRoleClient();
        const { searchParams } = new URL(request.url);
        const location_code = searchParams.get('location_code') || '';
        const sku_id = searchParams.get('sku_id') || '';

        // Case 1: Query by sku_id - find the designated picking home for this SKU
        if (sku_id) {
            // First try sku_preparation_area_mapping table
            const { data: mappingData, error: mappingError } = await supabase
                .from('sku_preparation_area_mapping')
                .select(`
                    mapping_id,
                    sku_id,
                    warehouse_id,
                    preparation_area_id,
                    priority,
                    is_primary,
                    preparation_area:preparation_area_id (
                        area_id,
                        area_code,
                        area_name,
                        zone,
                        status
                    )
                `)
                .eq('sku_id', sku_id)
                .order('priority', { ascending: true });

            if (mappingError) {
                console.error('Error fetching SKU mapping:', mappingError);
                return NextResponse.json(
                    { error: 'Failed to fetch SKU mapping', details: mappingError.message },
                    { status: 500 }
                );
            }

            // If found in mapping table, use it
            if (mappingData && mappingData.length > 0) {
                // Transform to include location_code for easy access
                const transformedData = mappingData.map((m: any) => {
                    const prepArea = Array.isArray(m.preparation_area) ? m.preparation_area[0] : m.preparation_area;
                    return {
                        ...m,
                        location_code: prepArea?.area_code || null,
                        location_name: prepArea?.area_name || null
                    };
                });

                return NextResponse.json({
                    data: transformedData,
                    count: transformedData.length,
                    source: 'sku_preparation_area_mapping'
                });
            }

            // Fallback: Check master_sku.default_location
            const { data: skuData, error: skuError } = await supabase
                .from('master_sku')
                .select('sku_id, sku_name, default_location')
                .eq('sku_id', sku_id)
                .single();

            if (skuError && skuError.code !== 'PGRST116') {
                console.error('Error fetching SKU:', skuError);
            }

            if (skuData?.default_location) {
                // Get preparation area info for this default_location
                const { data: prepAreaData } = await supabase
                    .from('preparation_area')
                    .select('area_id, area_code, area_name, zone, status')
                    .eq('area_code', skuData.default_location)
                    .single();

                return NextResponse.json({
                    data: [{
                        sku_id: sku_id,
                        location_code: skuData.default_location,
                        location_name: prepAreaData?.area_name || skuData.default_location,
                        is_primary: true,
                        priority: 1,
                        preparation_area: prepAreaData || null
                    }],
                    count: 1,
                    source: 'master_sku.default_location'
                });
            }

            // No mapping found anywhere
            return NextResponse.json({
                data: [],
                count: 0,
                source: 'none'
            });
        }

        // Case 2: Query by location_code - check if it's a picking home and which SKUs belong there
        if (location_code) {
            // First check if location is a preparation area
            const { data: prepAreaData, error: prepAreaError } = await supabase
                .from('preparation_area')
                .select('area_id, area_code, area_name, zone, warehouse_id, status')
                .eq('area_code', location_code);

            if (prepAreaError) {
                console.error('Error fetching preparation area:', prepAreaError);
                return NextResponse.json(
                    { error: 'Failed to fetch preparation area', details: prepAreaError.message },
                    { status: 500 }
                );
            }

            // If not a preparation area, return empty
            if (!prepAreaData || prepAreaData.length === 0) {
                return NextResponse.json({
                    data: [],
                    count: 0,
                    is_picking_home: false
                });
            }

            const prepArea = prepAreaData[0];

            // Get all SKUs mapped to this preparation area from sku_preparation_area_mapping
            const { data: skuMappings, error: skuMappingsError } = await supabase
                .from('sku_preparation_area_mapping')
                .select('sku_id, priority, is_primary')
                .eq('preparation_area_id', prepArea.area_id)
                .order('priority', { ascending: true });

            if (skuMappingsError) {
                console.error('Error fetching SKU mappings:', skuMappingsError);
            }

            let allowedSkus: string[] = (skuMappings || []).map((m: any) => m.sku_id);

            // If no mapping found, fallback to master_sku.default_location
            if (allowedSkus.length === 0) {
                const { data: skusByDefault, error: skusByDefaultError } = await supabase
                    .from('master_sku')
                    .select('sku_id')
                    .eq('default_location', location_code);

                if (skusByDefaultError) {
                    console.error('Error fetching SKUs by default_location:', skusByDefaultError);
                }

                allowedSkus = (skusByDefault || []).map((s: any) => s.sku_id);
            }

            return NextResponse.json({
                data: [{
                    ...prepArea,
                    location_code: prepArea.area_code,
                    mapped_skus: skuMappings || []
                }],
                count: 1,
                is_picking_home: true,
                allowed_skus: allowedSkus,
                source: skuMappings && skuMappings.length > 0 ? 'sku_preparation_area_mapping' : 'master_sku.default_location'
            });
        }

        // No parameters - return error
        return NextResponse.json(
            { error: 'Either location_code or sku_id parameter is required' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Error in SKU preparation area mapping API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
