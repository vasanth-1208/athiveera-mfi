import React from 'react';
import { X, Printer, CheckCircle } from 'lucide-react';

interface ReceiptModalProps {
  receipt: any;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-amber-900/20 printable-area">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-[#fbf9f5] border-b border-[#ece3d4]">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-stone-900">Official Payment Receipt</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-8 space-y-6 text-stone-800">
          {/* Header with Athiveera Logo */}
          <div className="text-center border-b border-dashed border-amber-900/30 pb-5">
            <img src="/logo.png" alt="Athiveera Logo" className="h-14 w-auto mx-auto mb-2 object-contain" />
            <h2 className="text-xl font-black text-stone-900 tracking-tight">ATHIVEERA MICROFINANCE</h2>
            <p className="text-xs text-stone-600 mt-0.5">
              {receipt.branchId?.name || 'Pollachi Branch'} &bull; {receipt.branchId?.address || 'Tamil Nadu'}
            </p>
            <p className="text-[11px] text-stone-500 font-mono mt-0.5">Contact: {receipt.branchId?.phone || '+91 9500485596'}</p>
            <div className="mt-3 inline-block bg-amber-50 text-amber-900 border border-amber-200/80 px-3.5 py-1 rounded-full text-xs font-mono font-bold shadow-xs">
              RECEIPT NO: {receipt.receiptNumber}
            </div>
          </div>

          {/* Details Table */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-stone-500 font-medium">Customer Name:</p>
              <p className="font-bold text-stone-900 text-sm">{receipt.customerId?.name || 'Customer'}</p>
              <p className="text-stone-500 font-mono mt-0.5">ID: {receipt.customerId?.customerId || 'N/A'}</p>
              <p className="text-stone-500 font-mono">{receipt.customerId?.phone || ''}</p>
            </div>
            <div>
              <p className="text-stone-500 font-medium">Group & Route:</p>
              <p className="font-bold text-stone-900 text-sm">{receipt.groupId?.name || 'Group'}</p>
              <p className="text-stone-500">Day: <span className="font-semibold uppercase text-amber-800">{receipt.groupId?.collectionDay || 'Route'}</span></p>
              <p className="text-stone-500">Collector: {receipt.collectorId?.name || 'Staff'}</p>
            </div>
          </div>

          {/* Amount Paid Box in Gold Theme */}
          <div className="bg-gradient-to-r from-amber-50/80 via-yellow-50/50 to-orange-50/80 border border-amber-200 rounded-2xl p-4 text-center shadow-xs">
            <p className="text-xs uppercase font-bold text-amber-900/70 tracking-wider">Amount Received</p>
            <p className="text-3xl font-black text-amber-950 mt-1">₹{Number(receipt.amount).toLocaleString('en-IN')}</p>
            <p className="text-[11px] text-stone-500 font-mono mt-1">Payment Method: {receipt.paymentMethod || 'CASH'}</p>
          </div>

          {/* Schedule Allocations */}
          {receipt.allocations && receipt.allocations.length > 0 && (
            <div className="border border-stone-200 rounded-xl overflow-hidden text-xs">
              <div className="bg-stone-50 px-3 py-2 border-b border-stone-200 font-semibold text-stone-700">
                Installment Allocation Breakdown
              </div>
              <div className="divide-y divide-stone-100">
                {receipt.allocations.map((a: any, idx: number) => (
                  <div key={idx} className="px-3 py-2 flex items-center justify-between">
                    <span className="font-mono">Week #{a.installmentNumber}</span>
                    <span className="font-bold text-stone-900">₹{Number(a.amount).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="pt-4 border-t border-dashed border-amber-900/30 text-center text-[10px] text-stone-500 space-y-1">
            <p>Thank you for your prompt repayment. Please retain this receipt for your records.</p>
            <p className="font-mono text-[9px] text-stone-400">Computer Generated • Authorized Athiveera Microfinance Receipt</p>
          </div>
        </div>
      </div>
    </div>
  );
};
