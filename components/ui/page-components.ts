/**
 * Page Components - ใช้สำหรับสร้างหน้าแบบ compact layout
 * 
 * ## Components:
 * - **PageContainer** - Container หลักของหน้า ใช้ครอบทุกหน้าเพื่อให้ layout เหมือนกัน
 * - **PageHeaderWithFilters** - Header + Filters รวมกันในแถวเดียว
 * - **SearchInput** - Input ค้นหาแบบ compact พร้อม icon
 * - **FilterSelect** - Dropdown select สำหรับ filter
 * - **FilterCheckbox** - Checkbox สำหรับ filter
 * - **DataTableWithPagination** - ตารางพร้อม pagination bar ติดด้านล่างเสมอ
 * 
 * ## Features:
 * - Pagination bar ติดด้านล่างเสมอ ไม่ว่าจะมีข้อมูลกี่แถว
 * - รองรับ loading, error, empty states
 * - Compact design สำหรับแสดงข้อมูลจำนวนมาก
 * 
 * @example
 * import { 
 *   PageContainer, 
 *   PageHeaderWithFilters, 
 *   SearchInput, 
 *   FilterSelect, 
 *   FilterCheckbox,
 *   DataTableWithPagination 
 * } from '@/components/ui/page-components';
 * 
 * // ใช้งาน
 * <PageContainer>
 *   <PageHeaderWithFilters title="ยอดสต็อกคงเหลือ">
 *     <SearchInput value={search} onChange={setSearch} placeholder="ค้นหา..." />
 *     <FilterSelect value={warehouse} onChange={setWarehouse} options={warehouseOptions} />
 *     <FilterCheckbox label="สต็อกต่ำ" checked={showLow} onChange={setShowLow} />
 *     <input type="date" value={date} onChange={(e) => setDate(e.target.value)} 
 *            className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs" />
 *     <Button variant="primary" size="sm" className="text-xs py-1 px-2">รีเฟรช</Button>
 *   </PageHeaderWithFilters>
 *   
 *   <DataTableWithPagination
 *     data={filteredData}
 *     columns={columns}
 *     loading={loading}
 *     error={error}
 *     pageSize={100}
 *     emptyTitle="ไม่พบข้อมูล"
 *     emptyDescription="ลองปรับเปลี่ยนตัวกรอง"
 *   />
 * </PageContainer>
 * 
 * // สำหรับหน้าที่ใช้ custom table (เช่น มี inline editing, expandable rows)
 * // ให้ใช้โครงสร้างนี้เพื่อให้ pagination bar ติดด้านล่างเสมอ:
 * // <PageContainer>
 * //   <PageHeaderWithFilters title="คำสั่งซื้อ">...</PageHeaderWithFilters>
 * //   <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
 * //     <div className="flex-1 overflow-auto">
 * //       <Table>...</Table>
 * //     </div>
 * //     <div className="flex-shrink-0 ... border-t bg-gray-50 rounded-b-lg">
 * //       Pagination controls here
 * //     </div>
 * //   </div>
 * // </PageContainer>
 */

export { default as PageContainer } from './PageContainer';
export { default as PageHeaderWithFilters } from './PageHeaderWithFilters';
export { default as SearchInput } from './SearchInput';
export { default as FilterSelect } from './FilterSelect';
export { default as FilterCheckbox } from './FilterCheckbox';
export { default as DataTableWithPagination } from './DataTableWithPagination';
export { default as PaginationBar } from './PaginationBar';
export type { Column, DataTableWithPaginationProps } from './DataTableWithPagination';
export type { PaginationBarProps } from './PaginationBar';
