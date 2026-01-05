'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Check } from 'lucide-react';

interface Employee {
  employee_id: number;
  first_name: string;
  last_name: string;
  nickname?: string;
  wms_role?: string;
}

interface EmployeeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (checkerIds: string[], pickerIds: string[]) => void;
  title?: string;
  mode?: 'both' | 'checker-only';
  defaultCheckerId?: number;
  checkerEmployee?: {
    employee_id: number;
    first_name: string;
    last_name: string;
    nickname?: string;
    employee_code: string;
  };
  pickerEmployee?: {
    employee_id: number;
    first_name: string;
    last_name: string;
    nickname?: string;
    employee_code: string;
  };
  pickerEmployees?: Array<{
    employee_id: number;
    first_name: string;
    last_name: string;
    nickname?: string;
    employee_code: string;
  }>;
  checkerEmployees?: Array<{
    employee_id: number;
    first_name: string;
    last_name: string;
    nickname?: string;
    employee_code: string;
  }>;
}

export default function EmployeeSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'เลือกพนักงาน',
  mode = 'both',
  defaultCheckerId,
  checkerEmployee,
  pickerEmployee,
  pickerEmployees,
  checkerEmployees
}: EmployeeSelectionModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkerIds, setCheckerIds] = useState<string[]>([]);
  const [pickerIds, setPickerIds] = useState<string[]>([]);

  // Set default checker when modal opens
  useEffect(() => {
    if (isOpen && defaultCheckerId) {
      setCheckerIds([defaultCheckerId.toString()]);
    }
  }, [isOpen, defaultCheckerId]);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
    }
  }, [isOpen]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/employees');
      const result = await response.json();

      if (response.ok) {
        // API returns array directly
        if (Array.isArray(result)) {
          console.log('✅ [fetchEmployees] Loaded employees:', result.length);
          setEmployees(result);
        } else if (result.data && Array.isArray(result.data)) {
          console.log('✅ [fetchEmployees] Loaded employees from data:', result.data.length);
          setEmployees(result.data);
        } else {
          console.error('❌ [fetchEmployees] Unexpected response format:', result);
        }
      } else {
        console.error('❌ [fetchEmployees] Response not OK:', response.status);
      }
    } catch (error) {
      console.error('❌ [fetchEmployees] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (mode === 'checker-only') {
      if (checkerIds.length === 0) {
        alert('กรุณาเลือกผู้เช็คสินค้า');
        return;
      }
      onConfirm(checkerIds, []);
      setCheckerIds([]);
    } else {
      if (checkerIds.length === 0 || pickerIds.length === 0) {
        alert('กรุณาเลือกพนักงานให้ครบถ้วน');
        return;
      }
      onConfirm(checkerIds, pickerIds);
      setCheckerIds([]);
      setPickerIds([]);
    }
  };

  const handleClose = () => {
    setCheckerIds([]);
    setPickerIds([]);
    onClose();
  };

  const toggleChecker = (employeeId: number) => {
    const idStr = employeeId.toString();
    // เลือกได้แค่คนเดียว (radio behavior)
    setCheckerIds([idStr]);
  };

  const togglePicker = (employeeId: number) => {
    const idStr = employeeId.toString();
    setPickerIds(prev => 
      prev.includes(idStr)
        ? prev.filter(id => id !== idStr)
        : [...prev, idStr]
    );
  };

  if (!isOpen) return null;

  const getEmployeeDisplay = (emp: Employee) => {
    const name = emp.nickname || `${emp.first_name} ${emp.last_name}`;
    return name;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-xl sm:rounded-lg shadow-xl w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] my-auto overflow-hidden flex flex-col">
        {/* Header - Compact */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-sky-50 flex-shrink-0">
          <h2 className="text-sm font-bold text-gray-900 font-thai">{title}</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500 mx-auto"></div>
              <p className="text-gray-500 mt-2 font-thai text-xs">กำลังโหลด...</p>
            </div>
          ) : (
            <>
              {/* Checker Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-thai">
                  <User className="w-3.5 h-3.5 inline mr-1" />
                  {mode === 'checker-only' ? 'เลือกผู้เช็คโหลดใหม่' : 'เลือกผู้เช็คสินค้า'} ({checkerIds.length} คน)
                </label>
                <div className="border border-gray-300 rounded max-h-36 overflow-y-auto">
                  {employees.length === 0 && !loading && (
                    <div className="px-2 py-1.5 text-xs text-gray-500 font-thai">
                      ไม่พบข้อมูลพนักงาน
                    </div>
                  )}
                  {employees.map((emp) => (
                    <label
                      key={`checker-${emp.employee_id}`}
                      className="flex items-center px-2 py-1.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="radio"
                        name="checker"
                        checked={checkerIds.includes(emp.employee_id.toString())}
                        onChange={() => toggleChecker(emp.employee_id)}
                        className="w-3.5 h-3.5 text-sky-500 border-gray-300 focus:ring-sky-500"
                      />
                      <span className="ml-2 text-xs font-thai text-gray-900">
                        {getEmployeeDisplay(emp)}
                        {emp.wms_role && (
                          <span className="text-gray-500 text-[10px] ml-1">({emp.wms_role})</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Read-only Info for checker-only mode */}
              {mode === 'checker-only' && (
                <>
                  {/* Checker Info (Read-only) */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 font-thai">
                      <User className="w-3.5 h-3.5 inline mr-1" />
                      ผู้เช็คโหลดที่กำหนดไว้
                    </label>
                    <div className="border border-blue-300 rounded bg-blue-50 px-2 py-1.5">
                      {checkerEmployee ? (
                        <>
                          <span className="text-xs font-thai text-gray-900">
                            {checkerEmployee.nickname || `${checkerEmployee.first_name} ${checkerEmployee.last_name}`}
                          </span>
                          <span className="text-gray-500 text-[10px] ml-1">
                            ({checkerEmployee.employee_code})
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-thai text-gray-500 italic">
                          ยังไม่ได้กำหนดผู้เช็คโหลด
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Picker Info (Read-only) */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 font-thai">
                      <User className="w-3.5 h-3.5 inline mr-1" />
                      พนักงานจัดสินค้า {((pickerEmployees?.length || 0) + (checkerEmployees?.length || 0)) > 0 && `(${(pickerEmployees?.length || 0) + (checkerEmployees?.length || 0)} คน)`}
                    </label>
                    <div className="border border-gray-300 rounded bg-gray-50 px-2 py-1.5">
                      {(pickerEmployees && pickerEmployees.length > 0) || (checkerEmployees && checkerEmployees.length > 0) ? (
                        <div className="space-y-0.5 max-h-20 overflow-y-auto">
                          {pickerEmployees?.map((picker, index) => (
                            <div key={picker.employee_id} className="flex items-center text-xs">
                              <span className="font-thai text-gray-900">
                                {index + 1}. {picker.nickname || `${picker.first_name} ${picker.last_name}`}
                              </span>
                              <span className="text-gray-500 text-[10px] ml-1">
                                ({picker.employee_code})
                              </span>
                            </div>
                          ))}
                          {checkerEmployees?.map((checker, index) => (
                            <div key={checker.employee_id} className="flex items-center text-xs">
                              <span className="font-thai text-gray-900">
                                {(pickerEmployees?.length || 0) + index + 1}. {checker.nickname || `${checker.first_name} ${checker.last_name}`}
                              </span>
                              <span className="text-gray-500 text-[10px] ml-1">
                                ({checker.employee_code})
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : pickerEmployee ? (
                        <>
                          <span className="text-xs font-thai text-gray-900">
                            {pickerEmployee.nickname || `${pickerEmployee.first_name} ${pickerEmployee.last_name}`}
                          </span>
                          <span className="text-gray-500 text-[10px] ml-1">
                            ({pickerEmployee.employee_code})
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-thai text-gray-500 italic">
                          ยังไม่ได้กำหนดผู้จัดสินค้า
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Picker Selection (for both mode) */}
              {mode === 'both' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5 font-thai">
                    <User className="w-3.5 h-3.5 inline mr-1" />
                    พนักงานจัดสินค้า ({pickerIds.length} คน)
                  </label>
                  <div className="border border-gray-300 rounded max-h-36 overflow-y-auto">
                    {employees.map((emp) => (
                      <label
                        key={`picker-${emp.employee_id}`}
                        className="flex items-center px-2 py-1.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={pickerIds.includes(emp.employee_id.toString())}
                          onChange={() => togglePicker(emp.employee_id)}
                          className="w-3.5 h-3.5 text-sky-500 border-gray-300 rounded focus:ring-sky-500"
                        />
                        <span className="ml-2 text-xs font-thai text-gray-900">
                          {getEmployeeDisplay(emp)}
                          {emp.wms_role && (
                            <span className="text-gray-500 text-[10px] ml-1">({emp.wms_role})</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary - Compact */}
              {mode === 'checker-only' && checkerIds.length > 0 && (
                <div className="bg-sky-50 border border-sky-200 rounded p-2 text-xs font-thai">
                  <p className="text-gray-700">
                    <span className="font-medium">ผู้เช็คโหลดจริง:</span>{' '}
                    {checkerIds.map(id => {
                      const emp = employees.find(e => e.employee_id.toString() === id);
                      return emp ? getEmployeeDisplay(emp) : '';
                    }).join(', ')}
                  </p>
                </div>
              )}
              {mode === 'both' && checkerIds.length > 0 && pickerIds.length > 0 && (
                <div className="bg-sky-50 border border-sky-200 rounded p-2 text-xs font-thai">
                  <p className="text-gray-700 mb-1">
                    <span className="font-medium">พนักงานเช็ค:</span>{' '}
                    {checkerIds.map(id => {
                      const emp = employees.find(e => e.employee_id.toString() === id);
                      return emp ? getEmployeeDisplay(emp) : '';
                    }).join(', ')}
                  </p>
                  <p className="text-gray-700">
                    <span className="font-medium">พนักงานจัด:</span>{' '}
                    {pickerIds.map(id => {
                      const emp = employees.find(e => e.employee_id.toString() === id);
                      return emp ? getEmployeeDisplay(emp) : '';
                    }).join(', ')}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer - Compact */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 flex space-x-2 flex-shrink-0 pb-6 sm:pb-3">
          <button
            onClick={handleClose}
            className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded font-thai font-medium text-sm hover:bg-gray-100 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              loading || 
              checkerIds.length === 0 || 
              (mode === 'both' && pickerIds.length === 0)
            }
            className="flex-1 px-3 py-2 bg-sky-500 text-white rounded font-thai font-medium text-sm hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}
