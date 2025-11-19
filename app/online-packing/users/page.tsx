'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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
      <div className="min-h-screen bg-gradient-to-br from-lightBlue to-softWhite font-thai flex items-center justify-center">
        <div className="text-center p-8 card-modern">
          <div className="animate-spin w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-6"></div>
          <p className="text-xl font-bold text-gray-700 font-thai">กำลังโหลดข้อมูลผู้ใช้...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-lightBlue to-softWhite font-thai">
      {/* Header */}
      <header className="glass-morphism shadow-xl border-b border-primary-200/40">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="p-4 bg-gradient-to-r from-primary-300 to-primary-400 rounded-2xl shadow-xl">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text font-thai">
                  จัดการผู้ใช้และสิทธิ์
                </h1>
                <p className="text-lg text-gray-600 font-thai font-medium">User Management & Permissions</p>
              </div>
            </div>

            <button
              onClick={() => window.location.href = '/online-packing'}
              className="primary-button text-white px-6 py-3 rounded-xl font-thai font-medium transition-all duration-300 shadow-lg hover:shadow-xl card-hover"
            >
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white/90 backdrop-blur-sm shadow-lg border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex space-x-8">
            {[
              { id: 'users', name: 'ผู้ใช้งาน', desc: 'จัดการข้อมูลผู้ใช้' },
              { id: 'permissions', name: 'สิทธิ์การเข้าถึง', desc: 'กำหนดสิทธิ์เมนู' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-5 px-8 border-b-3 font-thai font-medium text-sm transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 bg-gradient-to-b from-primary-50/50 to-transparent shadow-sm'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50/50'
                }`}
              >
                <div className="text-base font-bold">{tab.name}</div>
                <div className="text-xs text-gray-500 font-thai">{tab.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
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
      </main>
    </div>
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
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-3xl font-bold text-gray-800 font-thai">จัดการผู้ใช้งาน</h2>
        <button
          onClick={() => openModal()}
          className="primary-button text-white px-8 py-4 rounded-xl font-thai font-bold transition-all duration-300 shadow-lg hover:shadow-xl card-hover"
        >
          + เพิ่มผู้ใช้ใหม่
        </button>
      </div>

      {/* Users Table */}
      <div className="card-modern overflow-hidden fade-in">
        <div className="overflow-x-auto">
          <table className="w-full table-auto min-w-[1000px]">
            <thead className="bg-gradient-to-r from-primary-200 to-primary-300">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-800 border-b border-primary-400/30 font-thai min-w-[80px]">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-800 border-b border-primary-400/30 font-thai min-w-[120px]">ชื่อผู้ใช้</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-800 border-b border-primary-400/30 font-thai min-w-[150px]">ชื่อจริง</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-800 border-b border-primary-400/30 font-thai min-w-[200px]">อีเมล</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-800 border-b border-primary-400/30 font-thai min-w-[100px]">บทบาท</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-800 border-b border-primary-400/30 font-thai min-w-[100px]">สถานะ</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-800 border-b border-primary-400/30 font-thai min-w-[120px]">ล็อกอินล่าสุด</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-800 border-b border-primary-400/30 font-thai min-w-[100px]">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: User, index: number) => (
                <tr key={user.id} className={`border-b border-gray-100/50 hover:bg-primary-50/30 transition-all duration-200 ${
                  index % 2 === 0 ? 'bg-white/80' : 'bg-gray-50/50'
                }`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-primary-600 font-semibold text-sm">{user.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900 font-thai text-sm">{user.username}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900 font-thai text-sm">{user.full_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-600 font-thai text-sm">{user.email || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold font-thai border ${getRoleColor(user.role).replace('bg-', 'bg-').replace('text-', 'text-')} ${getRoleColor(user.role).includes('red') ? 'border-red-200' : getRoleColor(user.role).includes('orange') ? 'border-orange-200' : getRoleColor(user.role).includes('blue') ? 'border-blue-200' : 'border-gray-200'}`}>
                      {getRoleName(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold font-thai border ${
                      user.is_active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'
                    }`}>
                      {user.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500 font-thai">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString('th-TH') : 'ยังไม่เคยล็อกอิน'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => openModal(user)}
                        className="text-primary-600 hover:text-primary-800 text-xs font-semibold font-thai transition-colors duration-200"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => onDelete(user.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-semibold font-thai transition-colors duration-200"
                      >
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
          <div className="card-modern max-w-3xl w-full max-h-screen overflow-y-auto fade-in">
            <div className="p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-8 font-thai">
                {selectedUser ? 'แก้ไขข้อมูลผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">ID ผู้ใช้</label>
                    <input
                      type="text"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                      required
                      placeholder="เช่น USER00009"
                      disabled={!!selectedUser}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">ชื่อผู้ใช้</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                      required
                      placeholder="ชื่อผู้ใช้สำหรับล็อกอิน"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">รหัสผ่าน</label>
                  <input
                    type="password"
                    value={formData.password_hash}
                    onChange={(e) => setFormData({ ...formData, password_hash: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                    required={!selectedUser}
                    placeholder={selectedUser ? "เว้นว่างหากไม่ต้องการเปลี่ยน" : "รหัสผ่าน"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">ชื่อจริง</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                    required
                    placeholder="ชื่อ-นามสกุล"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">อีเมล</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                    placeholder="อีเมลสำหรับติดต่อ (ไม่บังคับ)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">บทบาท</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                    required
                  >
                    <option value="viewer" className="font-thai">ผู้ดู (Viewer) - ดูรายงานเท่านั้น</option>
                    <option value="user" className="font-thai">ผู้ใช้งาน (User) - ใช้งานพื้นฐาน</option>
                    <option value="manager" className="font-thai">ผู้จัดการ (Manager) - จัดการข้อมูล</option>
                    <option value="admin" className="font-thai">ผู้ดูแลระบบ (Admin) - เข้าถึงทุกอย่าง</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded-lg"
                  />
                  <label htmlFor="is_active" className="ml-3 text-sm font-semibold text-gray-700 font-thai">
                    เปิดใช้งานผู้ใช้นี้
                  </label>
                </div>

                <div className="flex justify-end space-x-4 pt-8 border-t border-gray-200/50">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-3 bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 text-gray-700 rounded-xl font-thai font-semibold transition-all duration-300"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 primary-button text-white rounded-xl font-thai font-bold transition-all duration-300 shadow-lg hover:shadow-xl card-hover"
                  >
                    {selectedUser ? 'อัปเดต' : 'เพิ่มผู้ใช้'}
                  </button>
                </div>
              </form>
            </div>
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
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-gray-800 mb-4 font-thai">จัดการสิทธิ์การเข้าถึง</h2>
        <p className="text-gray-600 font-thai">เลือกผู้ใช้เพื่อกำหนดสิทธิ์การเข้าถึงเมนูต่างๆ</p>
      </div>

      {/* User Selection */}
      <div className="card-modern p-8 mb-10 fade-in">
        <h3 className="text-xl font-bold text-gray-800 mb-6 font-thai">เลือกผู้ใช้</h3>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai text-lg bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
        >
          <option value="" className="font-thai">-- เลือกผู้ใช้ --</option>
          {users.map((user: User) => (
            <option key={user.id} value={user.id} className="font-thai">
              {user.id} - {user.full_name} ({user.role})
            </option>
          ))}
        </select>
      </div>

      {/* Permissions Matrix */}
      {selectedUser && (
        <div className="card-modern overflow-hidden fade-in">
          <div className="bg-gradient-to-r from-primary-50 to-primary-100 px-8 py-6 border-b border-primary-200/50">
            <h3 className="text-xl font-bold text-gray-800 font-thai">
              สิทธิ์ของ: {selectedUser.full_name} ({selectedUser.role})
            </h3>
          </div>

          <div className="p-8">
            {Object.entries(groupedMenus).map(([category, categoryMenus]) => (
              <div key={category} className="mb-10">
                <h4 className="text-lg font-bold text-gray-700 mb-6 pb-3 border-b-2 border-primary-200 font-thai">
                  {getCategoryName(category)}
                </h4>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {(categoryMenus as Menu[]).map((menu: Menu) => {
                    const permission = getUserPermission(selectedUserId, menu.menu_path)

                    return (
                      <div key={menu.menu_path} className="border border-gray-200/60 rounded-xl p-6 hover:shadow-lg hover:border-primary-300/50 transition-all duration-300 bg-white/50 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h5 className="font-bold text-gray-800 font-thai">{menu.menu_name}</h5>
                            <p className="text-sm text-gray-500 font-thai mt-1">{menu.description}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { key: 'can_access', label: 'เข้าถึง', color: 'blue' },
                            { key: 'can_create', label: 'สร้าง', color: 'green' },
                            { key: 'can_edit', label: 'แก้ไข', color: 'yellow' },
                            { key: 'can_delete', label: 'ลบ', color: 'red' },
                            { key: 'can_export', label: 'ส่งออก', color: 'purple' },
                            { key: 'can_print', label: 'พิมพ์', color: 'indigo' }
                          ].map(({ key, label, color }) => (
                            <label key={key} className="inline-flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                              <input
                                type="checkbox"
                                checked={permission?.[key as keyof UserPermission] || false}
                                onChange={(e) => onUpdatePermission(
                                  selectedUserId,
                                  menu.menu_path,
                                  { [key]: e.target.checked }
                                )}
                                className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded transition-all duration-200"
                              />
                              <span className="ml-3 text-xs font-semibold text-gray-700 font-thai">{label}</span>
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
        <div className="card-modern p-16 text-center fade-in">
          <div className="p-8 bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl border border-gray-200/50 inline-block shadow-sm">
            <svg className="w-20 h-20 text-gray-300 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <h3 className="text-xl font-bold text-gray-800 mb-4 font-thai">เลือกผู้ใช้เพื่อจัดการสิทธิ์</h3>
            <p className="text-gray-600 font-thai">กรุณาเลือกผู้ใช้จากรายการด้านบนเพื่อกำหนดสิทธิ์การเข้าถึงเมนูต่างๆ</p>
          </div>
        </div>
      )}
    </div>
  )
}
