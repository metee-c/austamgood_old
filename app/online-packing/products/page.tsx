'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// Type definitions for packing_products table
type Product = {
  id: number
  product_name: string | null
  parent_sku: string | null
  barcode: string | null
  is_sample: boolean | null
  created_at: string
  updated_at: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Form states
  const [formData, setFormData] = useState<{
    product_name: string
    parent_sku: string
    barcode: string
    is_sample: boolean
  }>({
    product_name: '',
    parent_sku: '',
    barcode: '',
    is_sample: false
  })

  useEffect(() => {
    setMounted(true)
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('packing_products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      alert('เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า')
    }
    setIsLoading(false)
  }

  const filteredProducts = useMemo(() => {
    return products.filter(product =>
      product.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.parent_sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [products, searchTerm])

  const handleAddProduct = async () => {
    if (!formData.product_name || !formData.parent_sku) {
      alert('กรุณากรอกชื่อสินค้าและ SKU')
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('packing_products')
        .insert({
          product_name: formData.product_name,
          parent_sku: formData.parent_sku,
          barcode: formData.barcode || null,
          is_sample: formData.is_sample
        })

      if (error) throw error

      await fetchProducts()
      setShowAddModal(false)
      resetForm()
      alert('เพิ่มสินค้าสำเร็จ')
    } catch (error) {
      console.error('Error adding product:', error)
      alert('เกิดข้อผิดพลาดในการเพิ่มสินค้า')
    }
    setIsSubmitting(false)
  }

  const handleEditProduct = async () => {
    if (!editingProduct || !formData.product_name || !formData.parent_sku) {
      alert('กรุณากรอกชื่อสินค้าและ SKU')
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('packing_products')
        .update({
          product_name: formData.product_name,
          parent_sku: formData.parent_sku,
          barcode: formData.barcode || null,
          is_sample: formData.is_sample,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingProduct.id)

      if (error) throw error

      await fetchProducts()
      setShowEditModal(false)
      setEditingProduct(null)
      resetForm()
      alert('แก้ไขสินค้าสำเร็จ')
    } catch (error) {
      console.error('Error updating product:', error)
      alert('เกิดข้อผิดพลาดในการแก้ไขสินค้า')
    }
    setIsSubmitting(false)
  }

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`คุณต้องการลบสินค้า "${product.product_name}" หรือไม่?`)) {
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('packing_products')
        .delete()
        .eq('id', product.id)

      if (error) throw error

      await fetchProducts()
      alert('ลบสินค้าสำเร็จ')
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('เกิดข้อผิดพลาดในการลบสินค้า')
    }
  }

  const resetForm = () => {
    setFormData({
      product_name: '',
      parent_sku: '',
      barcode: '',
      is_sample: false
    })
  }

  const openEditModal = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      product_name: product.product_name || '',
      parent_sku: product.parent_sku || '',
      barcode: product.barcode || '',
      is_sample: product.is_sample || false
    })
    setShowEditModal(true)
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-lightBlue to-softWhite font-thai" suppressHydrationWarning>
      <header className="glass-morphism shadow-xl border-b border-primary-200/40">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m18 0V18a2.25 2.25 0 01-2.25 2.25h-13.5A2.25 2.25 0 013 18V9.75m18 0V9.75"/>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text font-thai">ตั้งค่าสินค้า</h1>
                <p className="text-base text-gray-600 font-thai font-medium">Products Management</p>
              </div>
            </div>
            <button
              onClick={() => window.location.href = '/online-packing'}
              className="primary-button text-white px-6 py-3 rounded-xl text-sm font-thai font-medium transition-all duration-300 shadow-lg hover:shadow-xl card-hover"
              suppressHydrationWarning
            >
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="card-modern fade-in overflow-hidden">
          <div className="p-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 lg:mb-0 font-thai">
                จัดการข้อมูลสินค้า
                <span className="text-primary-600"> ({filteredProducts.length} รายการ)</span>
              </h2>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-3 rounded-xl font-thai font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  เพิ่มสินค้าใหม่
                </span>
              </button>
            </div>

            <div className="mb-6">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาด้วยชื่อสินค้า, SKU, หรือบาร์โค้ด..."
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
              />
            </div>

            {isLoading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-thai text-lg">กำลังโหลดข้อมูล...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                </svg>
                <p className="text-lg font-thai">ไม่พบข้อมูลสินค้า</p>
                <p className="text-sm text-gray-400 mt-1">เริ่มต้นโดยการเพิ่มสินค้าใหม่</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200/50 shadow-sm">
                <table className="w-full bg-white/80 backdrop-blur-sm">
                  <thead className="bg-gradient-to-r from-primary-500 to-primary-600">
                    <tr>
                      <th className="text-left py-4 px-6 font-semibold text-white">ชื่อสินค้า</th>
                      <th className="text-left py-4 px-6 font-semibold text-white">SKU</th>
                      <th className="text-left py-4 px-6 font-semibold text-white">บาร์โค้ด</th>
                      <th className="text-center py-4 px-6 font-semibold text-white">ตัวอย่าง</th>
                      <th className="text-left py-4 px-6 font-semibold text-white">วันที่สร้าง</th>
                      <th className="text-center py-4 px-6 font-semibold text-white">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="border-b border-gray-100/50 hover:bg-primary-50/30 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-semibold text-gray-800">{product.product_name}</div>
                        </td>
                        <td className="py-4 px-6">
                          <code className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm font-mono">
                            {product.parent_sku}
                          </code>
                        </td>
                        <td className="py-4 px-6">
                          {product.barcode ? (
                            <code className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-mono">
                              {product.barcode}
                            </code>
                          ) : (
                            <span className="text-gray-400 text-sm">ไม่มี</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {product.is_sample ? (
                            <span className="inline-flex px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
                              ✨ ตัวอย่าง
                            </span>
                          ) : (
                            <span className="inline-flex px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full border border-green-200">
                              📦 ปกติ
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-600">
                          {new Date(product.created_at).toLocaleDateString('th-TH')}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => openEditModal(product)}
                              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg shadow-md hover:bg-blue-600 transition-colors"
                              title="แก้ไข"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product)}
                              className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg shadow-md hover:bg-red-600 transition-colors"
                              title="ลบ"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card-modern max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto fade-in">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 font-thai">เพิ่มสินค้าใหม่</h3>
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="text-gray-400 hover:text-primary-600 p-2 rounded-lg transition-colors duration-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">
                    ชื่อสินค้า <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="product_name"
                    value={formData.product_name}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                    placeholder="ระบุชื่อสินค้า"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">
                    SKU (รหัสสินค้า) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="parent_sku"
                    value={formData.parent_sku}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                    placeholder="ระบุ SKU"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">
                    บาร์โค้ด
                  </label>
                  <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                    placeholder="ระบุบาร์โค้ด (ไม่บังคับ)"
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      name="is_sample"
                      checked={formData.is_sample}
                      onChange={handleFormChange}
                      className="w-5 h-5 text-primary-600 border-2 border-gray-300 rounded focus:ring-primary-500 focus:ring-offset-2"
                    />
                    <span className="text-sm font-semibold text-gray-700 font-thai">
                      สินค้าตัวอย่าง (Sample)
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-8">เช็คถ้าสินค้านี้เป็นตัวอย่างสำหรับทดลอง</p>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200/50">
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 font-thai font-medium rounded-xl transition-colors duration-300"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleAddProduct}
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-thai font-bold transition-all duration-300 shadow-lg hover:shadow-xl card-hover"
                >
                  {isSubmitting ? 'กำลังเพิ่ม...' : 'เพิ่มสินค้า'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card-modern max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto fade-in">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 font-thai">แก้ไขสินค้า</h3>
                <button
                  onClick={() => { setShowEditModal(false); setEditingProduct(null); resetForm(); }}
                  className="text-gray-400 hover:text-primary-600 p-2 rounded-lg transition-colors duration-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">
                    ชื่อสินค้า <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="product_name"
                    value={formData.product_name}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                    placeholder="ระบุชื่อสินค้า"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">
                    SKU (รหัสสินค้า) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="parent_sku"
                    value={formData.parent_sku}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                    placeholder="ระบุ SKU"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">
                    บาร์โค้ด
                  </label>
                  <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                    placeholder="ระบุบาร์โค้ด (ไม่บังคับ)"
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      name="is_sample"
                      checked={formData.is_sample}
                      onChange={handleFormChange}
                      className="w-5 h-5 text-primary-600 border-2 border-gray-300 rounded focus:ring-primary-500 focus:ring-offset-2"
                    />
                    <span className="text-sm font-semibold text-gray-700 font-thai">
                      สินค้าตัวอย่าง (Sample)
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-8">เช็คถ้าสินค้านี้เป็นตัวอย่างสำหรับทดลอง</p>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200/50">
                <button
                  onClick={() => { setShowEditModal(false); setEditingProduct(null); resetForm(); }}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 font-thai font-medium rounded-xl transition-colors duration-300"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleEditProduct}
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-thai font-bold transition-all duration-300 shadow-lg hover:shadow-xl card-hover"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
