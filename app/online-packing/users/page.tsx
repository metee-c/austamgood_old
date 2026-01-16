'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Plus } from 'lucide-react'
import { PageContainer, PageHeaderWithFilters } from '@/components/ui/page-components'
import Button from '@/components/ui/Button'

interface User {
  id: string
  username: string
  password_hash: string
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'user' | 'viewer'
  is_active: boolean
  last_login?: string
  created_at: string
}

interface Menu {
  id: string
  menu_path: string
  menu_name: string
  menu_icon: string
  category: string
  sort_order: number
  is_active: boolean
  description: string
}

interface UserPermission {
  id: string
  user_id: string
  menu_path: string
  can_access: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
  can_export: boolean
  can_print: boolean
  notes?: string
  granted_by?: string
  granted_at: string
  expires_at?: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [menus, setMenus] = useState<Menu[]>([])
  const [permissions, setPermissions] = useState<UserPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('users')

  // Load all data
  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    const supabase = createClient()
    setIsLoading(true)
    try {
      // Load users
      const { data: userData, error: userError } = await supabase
        .from('packing_users')
        .select('*')
        .order('id')

      if (userError) throw userError
      setUsers(userData || [])

      // Load menus
      const { data: menuData, error: menuError } = await supabase
        .from('packing_menus')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      if (menuError) throw menuError
      setMenus(menuData || [])

      // Load permissions
      const { data: permissionData, error: permissionError } = await supabase
        .from('packing_user_permissions')
        .select('*')
        .order('user_id', { ascending: true })
        .order('menu_path', { ascending: true })

      if (permissionError) throw permissionError
      setPermissions(permissionData || [])

    } catch (error) {
      console.error('Error loading data:', error)
    }
    setIsLoading(false)
  }

  const handleAddUser = async (userData: Omit<User, 'created_at'>) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('packing_users')
        .insert([userData])
        .select()

      if (error) throw error

      setUsers(prev => [...prev, data[0]])
      setIsUserModalOpen(false)
      setSelectedUser(null)

      // Create default permissions based on role
      await createDefaultPermissions(data[0])

    } catch (error) {
      console.error('Error adding user:', error)
      alert('เกิดข้อผิดพลาดในการเพิ่มผู้ใช้')
    }
  }

  const handleUpdateUser = async (id: string, userData: Partial<User>) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('packing_users')
        .update(userData)
        .eq('id', id)
        .select()

      if (error) throw error

      setUsers(prev => prev.map(user =>
        user.id === id ? { ...user, ...data[0] } : user
      ))
      setIsUserModalOpen(false)
      setSelectedUser(null)

    } catch (error) {
      console.error('Error updating user:', error)
      alert('เกิดข้อผิดพลาดในการอัปเดตผู้ใช้')
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('คุณต้องการลบผู้ใช้นี้หรือไม่?')) return

    const supabase = createClient()
    try {
      const { error } = await supabase
        .from('packing_users')
        .delete()
        .eq('id', id)

      if (error) throw error

      setUsers(prev => prev.filter(user => user.id !== id))

    } catch (error) {
      console.error('Error deleting user:', error)
      alert('เกิดข้อผิดพลาดในการลบผู้ใช้')
    }
  }

  const handleUpdatePermission = async (userId: string, menuPath: string, permissionData: Partial<UserPermission>) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('packing_user_permissions')
        .upsert([{
          user_id: userId,
          menu_path: menuPath,
          ...permissionData,
          granted_by: 'admin', // ใส่ ID ของ admin ที่ล็อกอินอยู่
        }], {
          onConflict: 'user_id,menu_path',
          ignoreDuplicates: false
        })
        .select()

      if (error) throw error

      // Update local permissions state
      setPermissions(prev => {
        const existingIndex = prev.findIndex(p => p.user_id === userId && p.menu_path === menuPath)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = { ...updated[existingIndex], ...data[0] }
          return updated
        } else {
          return [...prev, data[0]]
        }
      })

    } catch (error) {
      console.error('Error updating permission:', error)
      alert('เกิดข้อผิดพลาดในการอัปเดตสิทธิ์')
    }
  }

  const createDefaultPermissions = async (user: User) => {
    const supabase = createClient()
    try {
      let defaultPermissions: Partial<UserPermission>[] = []

      switch (user.role) {
        case 'admin':
          // Admin has full access to all menus
          defaultPermissions = menus.map(menu => ({
            user_id: user.id,
            menu_path: menu.menu_path,
            can_access: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_export: true,
            can_print: true,
            granted_by: 'system'
          }))
          break

        case 'manager':
          // Manager has access to all except admin menus
          defaultPermissions = menus
            .filter(menu => menu.category !== 'admin')
            .map(menu => ({
              user_id: user.id,
              menu_path: menu.menu_path,
              can_access: true,
              can_create: menu.category === 'operation',
              can_edit: menu.category === 'operation',
              can_delete: false,
              can_export: true,
              can_print: true,
              granted_by: 'system'
            }))
          break

        case 'user':
          // User has basic access to operation menus
          defaultPermissions = menus
            .filter(menu => ['operation', 'report'].includes(menu.category))
            .map(menu => ({
              user_id: user.id,
              menu_path: menu.menu_path,
              can_access: true,
              can_create: menu.category === 'operation',
              can_edit: false,
              can_delete: false,
              can_export: menu.category === 'report',
              can_print: menu.category === 'report',
              granted_by: 'system'
            }))
          break

        case 'viewer':
          // Viewer has read-only access to reports
          defaultPermissions = menus
            .filter(menu => menu.category === 'report')
            .map(menu => ({
              user_id: user.id,
              menu_path: menu.menu_path,
              can_access: true,
              can_create: false,
              can_edit: false,
              can_delete: false,
              can_export: true,
              can_print: true,
              granted_by: 'system'
            }))
          break
      }

      if (defaultPermissions.length > 0) {
        const { error } = await supabase
          .from('packing_user_permissions')
          .insert(defaultPermissions)

        if (error) throw error
        await loadAllData() // Reload to get updated permissions
      }

    } catch (error) {
      console.error('Error creating default permissions:', error)
    }
  }

  const getUserPermission = (userId: string, menuPath: string): UserPermission | null => {
    return permissions.find(p => p.user_id === userId && p.menu_path === menuPath) || null
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="animate-spin w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-sm font-medium text-gray-700">กำลังโหลดข้อมูลผู้ใช้...</p>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeaderWithFilters title="จัดการผู้ใช้">
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 ml-4 border-l border-gray-200 pl-4">
          {[
            { id: 'users', name: 'ผู้ใช้งาน' },
            { id: 'permissions', name: 'สิทธิ์การเข้าถึง' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </PageHeaderWithFilters>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-auto p-3">
        {activeTab === 'users' && (
          <UsersManagement
            users={users}
            onAdd={handleAddUser}
            onUpdate={handleUpdateUser}
            onDelete={handleDeleteUser}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            isModalOpen={isUserModalOpen}
            setIsModalOpen={setIsUserModalOpen}
          />
        )}

        {activeTab === 'permissions' && (
          <PermissionsManagement
            users={users}
            menus={menus}
            permissions={permissions}
            onUpdatePermission={handleUpdatePermission}
            getUserPermission={getUserPermission}
          />
        )}
      </div>
    </PageContainer>
  )
}

// Users Management Component
const UsersManagement = ({ users, onAdd, onUpdate, onDelete, selectedUser, setSelectedUser, isModalOpen, setIsModalOpen }: any) => {
  const [formData, setFormData] = useState({
    id: '',
    username: '',
    password_hash: '',
    full_name: '',
    email: '',
    role: 'user' as 'admin' | 'manager' | 'user' | 'viewer',
    is_active: true
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedUser) {
      onUpdate(selectedUser.id, formData)
    } else {
      onAdd(formData)
    }
  }

  const openModal = (user?: User) => {
    if (user) {
      setSelectedUser(user)
      setFormData({
        id: user.id,
        username: user.username,
        password_hash: user.password_hash,
        full_name: user.full_name,
        email: user.email || '',
        role: user.role,
        is_active: user.is_active
      })
    } else {
      setSelectedUser(null)
      setFormData({
        id: '',
        username: '',
        password_hash: '',
        full_name: '',
        email: '',
        role: 'user',
        is_active: true
      })
    }
    setIsModalOpen(true)
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'manager': return 'bg-orange-100 text-orange-800'
      case 'user': return 'bg-blue-100 text-blue-800'
      case 'viewer': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin': return 'ผู้ดูแลระบบ'
      case 'manager': return 'ผู้จัดการ'
      case 'user': return 'ผู้ใช้งาน'
      case 'viewer': return 'ผู้ดู'
      default: return role
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-gray-800">จัดการผู้ใช้งาน ({users.length} คน)</h2>
        <Button variant="primary" size="sm" onClick={() => openModal()} className="text-xs">
          <Plus className="w-3 h-3 mr-1" />
          เพิ่มผู้ใช้ใหม่
        </Button>
      </div>

      {/* Users Table */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold text-gray-600">ID</th>
                <th className="px-2 py-1.5 text-left font-semibold text-gray-600">ชื่อผู้ใช้</th>
                <th className="px-2 py-1.5 text-left font-semibold text-gray-600">ชื่อจริง</th>
                <th className="px-2 py-1.5 text-left font-semibold text-gray-600">อีเมล</th>
                <th className="px-2 py-1.5 text-center font-semibold text-gray-600">บทบาท</th>
                <th className="px-2 py-1.5 text-center font-semibold text-gray-600">สถานะ</th>
                <th className="px-2 py-1.5 text-center font-semibold text-gray-600">ล็อกอินล่าสุด</th>
                <th className="px-2 py-1.5 text-center font-semibold text-gray-600">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: User, index: number) => (
                <tr key={user.id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-2 py-1.5 font-mono text-primary-600 font-medium">{user.id}</td>
                  <td className="px-2 py-1.5 font-medium text-gray-900">{user.username}</td>
                  <td className="px-2 py-1.5 text-gray-900">{user.full_name}</td>
                  <td className="px-2 py-1.5 text-gray-600">{user.email || '-'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${getRoleColor(user.role)}`}>
                      {getRoleName(user.role)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'ใช้งาน' : 'ปิด'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString('th-TH') : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openModal(user)} className="text-primary-600 hover:text-primary-800 font-medium">
                        แก้ไข
                      </button>
                      <button onClick={() => onDelete(user.id)} className="text-red-600 hover:text-red-800 font-medium">
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold text-gray-800">
                {selectedUser ? 'แก้ไขข้อมูลผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ID ผู้ใช้</label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                    required
                    placeholder="เช่น USER00009"
                    disabled={!!selectedUser}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อผู้ใช้</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                    required
                    placeholder="ชื่อผู้ใช้สำหรับล็อกอิน"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">รหัสผ่าน</label>
                <input
                  type="password"
                  value={formData.password_hash}
                  onChange={(e) => setFormData({ ...formData, password_hash: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  required={!selectedUser}
                  placeholder={selectedUser ? "เว้นว่างหากไม่ต้องการเปลี่ยน" : "รหัสผ่าน"}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อจริง</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  required
                  placeholder="ชื่อ-นามสกุล"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">อีเมล</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="อีเมลสำหรับติดต่อ (ไม่บังคับ)"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">บทบาท</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="viewer">ผู้ดู (Viewer) - ดูรายงานเท่านั้น</option>
                  <option value="user">ผู้ใช้งาน (User) - ใช้งานพื้นฐาน</option>
                  <option value="manager">ผู้จัดการ (Manager) - จัดการข้อมูล</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin) - เข้าถึงทุกอย่าง</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 text-xs font-medium text-gray-700">
                  เปิดใช้งานผู้ใช้นี้
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button variant="secondary" size="sm" type="button" onClick={() => setIsModalOpen(false)} className="text-xs">
                  ยกเลิก
                </Button>
                <Button variant="primary" size="sm" type="submit" className="text-xs">
                  {selectedUser ? 'อัปเดต' : 'เพิ่มผู้ใช้'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Permissions Management Component
const PermissionsManagement = ({ users, menus, permissions, onUpdatePermission, getUserPermission }: any) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  const selectedUser = users.find((u: User) => u.id === selectedUserId)

  const groupedMenus = menus.reduce((acc: any, menu: Menu) => {
    if (!acc[menu.category]) {
      acc[menu.category] = []
    }
    acc[menu.category].push(menu)
    return acc
  }, {})

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'operation': return '🔄 การดำเนินงาน'
      case 'report': return '📊 รายงาน'
      case 'data': return '📁 จัดการข้อมูล'
      case 'admin': return '⚙️ การตั้งค่าระบบ'
      default: return category
    }
  }

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">จัดการสิทธิ์การเข้าถึง</h2>
        <p className="text-xs text-gray-500">เลือกผู้ใช้เพื่อกำหนดสิทธิ์การเข้าถึงเมนูต่างๆ</p>
      </div>

      {/* User Selection */}
      <div className="bg-white border rounded-lg p-3 mb-3">
        <label className="block text-xs font-medium text-gray-700 mb-1">เลือกผู้ใช้</label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="w-full max-w-md px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">-- เลือกผู้ใช้ --</option>
          {users.map((user: User) => (
            <option key={user.id} value={user.id}>
              {user.id} - {user.full_name} ({user.role})
            </option>
          ))}
        </select>
      </div>

      {/* Permissions Matrix */}
      {selectedUser && (
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 border-b">
            <h3 className="text-xs font-semibold text-gray-800">
              สิทธิ์ของ: {selectedUser.full_name} ({selectedUser.role})
            </h3>
          </div>

          <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto">
            {Object.entries(groupedMenus).map(([category, categoryMenus]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold text-gray-700 mb-2 pb-1 border-b">
                  {getCategoryName(category)}
                </h4>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {(categoryMenus as Menu[]).map((menu: Menu) => {
                    const permission = getUserPermission(selectedUserId, menu.menu_path)

                    return (
                      <div key={menu.menu_path} className="border border-gray-200 rounded p-2 hover:bg-gray-50">
                        <div className="mb-2">
                          <h5 className="text-xs font-medium text-gray-800">{menu.menu_name}</h5>
                          <p className="text-[10px] text-gray-500">{menu.description}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { key: 'can_access', label: 'เข้าถึง' },
                            { key: 'can_create', label: 'สร้าง' },
                            { key: 'can_edit', label: 'แก้ไข' },
                            { key: 'can_delete', label: 'ลบ' },
                            { key: 'can_export', label: 'ส่งออก' },
                            { key: 'can_print', label: 'พิมพ์' }
                          ].map(({ key, label }) => (
                            <label key={key} className="inline-flex items-center cursor-pointer p-1 rounded hover:bg-gray-100">
                              <input
                                type="checkbox"
                                checked={permission?.[key as keyof UserPermission] || false}
                                onChange={(e) => onUpdatePermission(
                                  selectedUserId,
                                  menu.menu_path,
                                  { [key]: e.target.checked }
                                )}
                                className="w-3 h-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                              <span className="ml-1 text-[10px] text-gray-700">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!selectedUser && (
        <div className="bg-white border rounded-lg p-8 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <h3 className="text-sm font-medium text-gray-800 mb-1">เลือกผู้ใช้เพื่อจัดการสิทธิ์</h3>
          <p className="text-xs text-gray-500">กรุณาเลือกผู้ใช้จากรายการด้านบน</p>
        </div>
      )}
    </div>
  )
}
