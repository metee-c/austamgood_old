'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Check } from 'lucide-react';

interface Employee {
  employee_id: string;
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
}

export default function EmployeeSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'เลือกพนักงาน'
}: EmployeeSelectionModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkerIds, setCheckerIds] = useState<string[]>([]);
  const [pickerIds, setPickerIds] = useState<string[]>([]);

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

      if (response.ok && result.data) {
        setEmployees(result.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (checkerIds.length === 0 || pickerIds.length === 0) {
      alert('กรุณาเลือกพนักงานให้ครบถ้วน');
      return;
    }

    onConfirm(checkerIds, pickerIds);
    setCheckerIds([]);
    setPickerIds([]);
  };

  const handleClose = () => {
    setCheckerIds([]);
    setPickerIds([]);
    onClose();
  };

  const toggleChecker = (employeeId: string) => {
    setCheckerIds(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const togglePicker = (employeeId: string) => {
    setPickerIds(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  if (!isOpen) return null;

  const getEmployeeDisplay = (emp: Employee) => {
    const name = emp.nickname || `${emp.first_name} ${emp.last_name}`;
    return name;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-sky-50">
          <h2 className="text-lg font-bold text-gray-900 font-thai">{title}</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mx-auto"></div>
              <p className="text-gray-500 mt-2 font-thai text-sm">กำลังโหลด...</p>
            </div>
          ) : (
            <>
              {/* Checker Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-thai">
                  <User className="w-4 h-4 inline mr-1" />
                  พนักงานเช็ค ({checkerIds.length} คน)
                </label>
                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                  {employees.map((emp) => (
                    <label
                      key={`checker-${emp.employee_id}`}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={checkerIds.includes(emp.employee_id)}
                        onChange={() => toggleChecker(emp.employee_id)}
                        className="w-4 h-4 text-sky-500 border-gray-300 rounded focus:ring-sky-500"
                      />
                      <span className="ml-2 text-sm font-thai text-gray-900">
                        {getEmployeeDisplay(emp)}
                        {emp.wms_role && (
                          <span className="text-gray-500 text-xs ml-1">({emp.wms_role})</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Picker Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-thai">
                  <User className="w-4 h-4 inline mr-1" />
                  พนักงานจัดสินค้า ({pickerIds.length} คน)
                </label>
                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                  {employees.map((emp) => (
                    <label
                      key={`picker-${emp.employee_id}`}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={pickerIds.includes(emp.employee_id)}
                        onChange={() => togglePicker(emp.employee_id)}
                        className="w-4 h-4 text-sky-500 border-gray-300 rounded focus:ring-sky-500"
                      />
                      <span className="ml-2 text-sm font-thai text-gray-900">
                        {getEmployeeDisplay(emp)}
                        {emp.wms_role && (
                          <span className="text-gray-500 text-xs ml-1">({emp.wms_role})</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Summary */}
              {checkerIds.length > 0 && pickerIds.length > 0 && (
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm font-thai">
                  <p className="text-gray-700 mb-2">
                    <span className="font-medium">พนักงานเช็ค ({checkerIds.length}):</span>
                  </p>
                  <ul className="list-disc list-inside text-gray-600 text-xs mb-2 ml-2">
                    {checkerIds.map(id => {
                      const emp = employees.find(e => e.employee_id === id);
                      return emp ? <li key={id}>{getEmployeeDisplay(emp)}</li> : null;
                    })}
                  </ul>
                  <p className="text-gray-700 mb-2">
                    <span className="font-medium">พนักงานจัดสินค้า ({pickerIds.length}):</span>
                  </p>
                  <ul className="list-disc list-inside text-gray-600 text-xs ml-2">
                    {pickerIds.map(id => {
                      const emp = employees.find(e => e.employee_id === id);
                      return emp ? <li key={id}>{getEmployeeDisplay(emp)}</li> : null;
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex space-x-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-thai font-medium hover:bg-gray-100 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleConfirm}
            disabled={checkerIds.length === 0 || pickerIds.length === 0 || loading}
            className="flex-1 px-4 py-2 bg-sky-500 text-white rounded-lg font-thai font-medium hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Check className="w-4 h-4 mr-1" />
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}
