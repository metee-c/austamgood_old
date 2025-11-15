import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  width?: string;
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
  width?: string;
}

const Table: React.FC<TableProps> & {
  Header: React.FC<TableHeaderProps>;
  Body: React.FC<TableBodyProps>;
  Row: React.FC<TableRowProps>;
  Head: React.FC<TableHeadProps>;
  Cell: React.FC<TableCellProps>;
} = ({ children, className = '' }) => {
  return (
    <table className={`w-full border-collapse text-sm ${className}`}>
      {children}
    </table>
  );
};

const TableHeader: React.FC<TableHeaderProps> = ({ children, className = '' }) => {
  return (
    <thead className={`sticky top-0 z-10 bg-gray-100 ${className}`}>
      {children}
    </thead>
  );
};

const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => {
  return (
    <tbody className={`bg-white divide-y divide-gray-100 ${className}`}>
      {children}
    </tbody>
  );
};

const TableRow: React.FC<TableRowProps> = ({ children, className = '', onClick }) => {
  return (
    <tr
      className={`
        hover:bg-blue-50/30 transition-colors duration-150
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

const TableHead: React.FC<TableHeadProps> = ({ children, className = '', onClick, width }) => {
  return (
    <th
      style={{ width }}
      className={`
        px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap font-thai
        ${onClick ? 'cursor-pointer hover:bg-gray-200' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </th>
  );
};

const TableCell: React.FC<TableCellProps> = ({ children, className = '', colSpan, width }) => {
  return (
    <td style={{ width }} className={`px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap font-thai ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
};

Table.Header = TableHeader;
Table.Body = TableBody;
Table.Row = TableRow;
Table.Head = TableHead;
Table.Cell = TableCell;

export default Table;
