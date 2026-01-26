'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, Plus, Edit, Trash2, X, Search } from 'lucide-react'
import { PageContainer, PageHeaderWithFilters, SearchInput } from '@/components/ui/page-components'
import Button from '@/components/ui/Button'

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

  if (!mounted) {
    return (
      <PageContainer>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-thai-gray-600 font-thai text-sm">กำลังโหลด...</p>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Header */}
      <PageHeaderWithFilters title="จัดการสินค้า">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาชื่อสินค้า, SKU, บาร์โค้ด..."
          className="w-64"
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-thai-gray-600 font-thai">{filteredProducts.length} รายการ</span>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setShowAddModal(true)}
            className="text-xs py-1 px-3"
          >
            เพิ่มสินค้า
          </Button>
        </div>
      </PageHeaderWithFilters>

      {/* Main Content */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-thai-gray-600 font-thai text-sm">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Package className="w-12 h-12 mx-auto mb-3 text-thai-gray-300" />
                <p className="text-sm font-thai text-thai-gray-600">ไม่พบข้อมูลสินค้า</p>
                <p className="text-xs text-thai-gray-400 mt-1 font-thai">เริ่มต้นโดยการเพิ่มสินค้าใหม่</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-[10px]">
              <thead className="bg-thai-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-2 px-3 font-semibold text-thai-gray-700 font-thai border-b">ชื่อสินค้า</th>
                  <th className="text-left py-2 px-3 font-semibold text-thai-gray-700 font-thai border-b">SKU</th>
                  <th className="text-left py-2 px-3 font-semibold text-thai-gray-700 font-thai border-b">บาร์โค้ด</th>
                  <th className="text-center py-2 px-3 font-semibold text-thai-gray-700 font-thai border-b">ประเภท</th>
                  <th className="text-left py-2 px-3 font-semibold text-thai-gray-700 font-thai border-b">วันที่สร้าง</th>
                  <th className="text-center py-2 px-3 font-semibold text-thai-gray-700 font-thai border-b">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-thai-gray-100 hover:bg-thai-gray-50/50 transition-colors">
                    <td className="py-1.5 px-3">
                      <div className="font-medium text-thai-gray-800 font-thai">{product.product_name}</div>
                    </td>
                    <td className="py-1.5 px-3">
                      <code className="px-1.5 py-0.5 bg-thai-gray-100 text-thai-gray-800 rounded text-[9px] font-mono">
                        {product.parent_sku}
                      </code>
                    </td>
                    <td className="py-1.5 px-3">
                      {product.barcode ? (
                        <code className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-mono">
                          {product.barcode}
                        </code>
                      ) : (
                        <span className="text-thai-gray-400 font-thai">-</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      {product.is_sample ? (
                        <span className="inline-flex px-1.5 py-0.5 text-[9px] font-medium bg-yellow-100 text-yellow-700 rounded border border-yellow-200 font-thai">
                          ตัวอย่าง
                        </span>
                      ) : (
                        <span className="inline-flex px-1.5 py-0.5 text-[9px] font-medium bg-green-100 text-green-700 rounded border border-green-200 font-thai">
                          ปกติ
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-thai-gray-600 font-thai">
                      {new Date(product.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="แก้ไข"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-3 py-2 border-t bg-thai-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between text-[10px] text-thai-gray-600 font-thai">
            <span>แสดง {filteredProducts.length} รายการ</span>
            <span>Products Management</span>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 shadow-2xl border border-thai-gray-200">
            <div className="flex justify-between items-center p-4 border-b border-thai-gray-200">
              <h3 className="text-sm font-bold text-thai-gray-800 font-thai">เพิ่มสินค้าใหม่</h3>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="text-thai-gray-400 hover:text-thai-gray-600 p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">
                  ชื่อสินค้า <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-thai-gray-200 rounded-lg text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="ระบุชื่อสินค้า"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">
                  SKU (รหัสสินค้า) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="parent_sku"
                  value={formData.parent_sku}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-thai-gray-200 rounded-lg text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="ระบุ SKU"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">
                  บาร์โค้ด
                </label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-thai-gray-200 rounded-lg text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="ระบุบาร์โค้ด (ไม่บังคับ)"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_sample"
                    checked={formData.is_sample}
                    onChange={handleFormChange}
                    className="w-4 h-4 text-primary-600 border-thai-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-xs font-medium text-thai-gray-700 font-thai">
                    สินค้าตัวอย่าง (Sample)
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-thai-gray-200 bg-thai-gray-50 rounded-b-xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="text-xs"
              >
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddProduct}
                loading={isSubmitting}
                className="text-xs"
              >
                {isSubmitting ? 'กำลังเพิ่ม...' : 'เพิ่มสินค้า'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 shadow-2xl border border-thai-gray-200">
            <div className="flex justify-between items-center p-4 border-b border-thai-gray-200">
              <h3 className="text-sm font-bold text-thai-gray-800 font-thai">แก้ไขสินค้า</h3>
              <button
                onClick={() => { setShowEditModal(false); setEditingProduct(null); resetForm(); }}
                className="text-thai-gray-400 hover:text-thai-gray-600 p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">
                  ชื่อสินค้า <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-thai-gray-200 rounded-lg text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="ระบุชื่อสินค้า"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">
                  SKU (รหัสสินค้า) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="parent_sku"
                  value={formData.parent_sku}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-thai-gray-200 rounded-lg text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="ระบุ SKU"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">
                  บาร์โค้ด
                </label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-thai-gray-200 rounded-lg text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="ระบุบาร์โค้ด (ไม่บังคับ)"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_sample"
                    checked={formData.is_sample}
                    onChange={handleFormChange}
                    className="w-4 h-4 text-primary-600 border-thai-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-xs font-medium text-thai-gray-700 font-thai">
                    สินค้าตัวอย่าง (Sample)
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-thai-gray-200 bg-thai-gray-50 rounded-b-xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowEditModal(false); setEditingProduct(null); resetForm(); }}
                className="text-xs"
              >
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleEditProduct}
                loading={isSubmitting}
                className="text-xs"
              >
                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
