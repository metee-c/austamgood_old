import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { EmployeeSchema, Employee } from '@/types/employee-schema';
export async function POST(request: Request) {
const supabase = await createClient();
  const employeesRaw = await request.json();

  if (!Array.isArray(employeesRaw)) {
    return NextResponse.json({ error: 'Request body must be an array of employees.' }, { status: 400 });
  }

  const validationResults = employeesRaw.map(emp => {
    // Convert empty strings to null, handle JSON parsing for allowed_warehouses
    const cleanedEmp = Object.entries(emp).reduce((acc, [key, value]) => {
      if (key === 'allowed_warehouses' && typeof value === 'string') {
        try {
          acc[key] = JSON.parse(value);
        } catch (e) {
          acc[key] = null; // Or handle error appropriately
        }
      } else {
        acc[key] = value === '' ? null : value;
      }
      return acc;
    }, {} as any);
    return EmployeeSchema.safeParse(cleanedEmp);
  });

  const validEmployees: Employee[] = [];
  const validationErrors: { index: number, errors: z.ZodFormattedError<Employee> }[] = [];

  validationResults.forEach((result, index) => {
    if (result.success) {
      validEmployees.push(result.data);
    } else {
      validationErrors.push({ index, errors: result.error.format() });
    }
  });

  if (validationErrors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: validationErrors }, { status: 400 });
  }

  if (validEmployees.length === 0) {
    return NextResponse.json({ error: 'No valid employee data to import.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('master_employee')
    .insert(validEmployees)
    .select();

  if (error) {
    console.error("Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: `${data.length} employees imported successfully.`, data });
}
