import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, Fuel, Calculator, Save, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    fuelPricePerLiter: 108,
    fuelMileageKmPerLiter: 50,
    fuelRatePerKm: 2.16,
    docChargesPercent: 6.0,
    companyName: 'Athiveera Microfinance',
    phone: '+91 9500485596',
    address: 'Pollachi & Madathukulam, Tamil Nadu'
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settingsData'],
    queryFn: () => api.getSettings()
  });

  useEffect(() => {
    if (data?.settings) {
      setFormData({
        fuelPricePerLiter: data.settings.fuelPricePerLiter || 108,
        fuelMileageKmPerLiter: data.settings.fuelMileageKmPerLiter || 50,
        fuelRatePerKm: data.settings.fuelRatePerKm || 2.16,
        docChargesPercent: data.settings.docChargesPercent || 6.0,
        companyName: data.settings.companyName || 'Athiveera Microfinance',
        phone: data.settings.phone || '+91 9500485596',
        address: data.settings.address || 'Pollachi & Madathukulam, Tamil Nadu'
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (body: any) => api.updateSettings(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settingsData'] });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  });

  const handlePriceOrMileageChange = (price: number, mileage: number) => {
    const rate = mileage > 0 ? parseFloat((price / mileage).toFixed(2)) : 2.16;
    setFormData({
      ...formData,
      fuelPricePerLiter: price,
      fuelMileageKmPerLiter: mileage,
      fuelRatePerKm: rate
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Business Rules & Parameter Settings</h2>
        <p className="text-xs text-slate-500">
          Configure financial formulas, staff travel reimbursement rates, early settlement discount tiers, and branch rules
        </p>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Settings successfully saved and active across both branches.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Petrol / Travel Reimbursement Calculation Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Fuel className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Staff Travel & Petrol Reimbursement Formula</h3>
              <p className="text-xs text-slate-500">Derived from Z LEDGER NOTE BOOK (Rate = Fuel Price / Vehicle Mileage)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fuel Price per Liter (₹)</label>
              <input
                type="number"
                step="0.1"
                value={formData.fuelPricePerLiter}
                onChange={(e) => handlePriceOrMileageChange(parseFloat(e.target.value) || 0, formData.fuelMileageKmPerLiter)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vehicle Mileage (KM / Liter)</label>
              <input
                type="number"
                step="1"
                value={formData.fuelMileageKmPerLiter}
                onChange={(e) => handlePriceOrMileageChange(formData.fuelPricePerLiter, parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Calculated Rate per KM (₹)</label>
              <input
                type="number"
                readOnly
                value={formData.fuelRatePerKm}
                className="w-full px-3 py-2 bg-amber-50/70 border border-amber-200 rounded-lg font-black text-amber-900 text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            Reimbursement Formula: Travel Distance (KM) &times; ₹{formData.fuelRatePerKm} = Claim Amount (INR)
          </p>
        </div>

        {/* Early Loan Settlement Discount Matrix (Read-only reference) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Calculator className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Early Loan Settlement & Interest Discount Matrix</h3>
              <p className="text-xs text-slate-500">From Z LEDGER NOTE BOOK sheet INTEREST DISCOUNT</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Elapsed Duration</th>
                  <th className="px-4 py-2.5">Interest Discount %</th>
                  <th className="px-4 py-2.5">Borrower Interest Due %</th>
                  <th className="px-4 py-2.5">Payoff Settlement Formula</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="px-4 py-2.5 font-bold text-slate-800">0 to 10 Weeks (Tier 1)</td>
                  <td className="px-4 py-2.5 text-emerald-600 font-bold">75% Discount</td>
                  <td className="px-4 py-2.5 text-slate-700">25% of balance interest</td>
                  <td className="px-4 py-2.5 text-slate-500 font-sans">Remaining Principal + 25% of balance interest</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-bold text-slate-800">11 to 20 Weeks (Tier 2)</td>
                  <td className="px-4 py-2.5 text-blue-600 font-bold">50% Discount</td>
                  <td className="px-4 py-2.5 text-slate-700">50% of balance interest</td>
                  <td className="px-4 py-2.5 text-slate-500 font-sans">Remaining Principal + 50% of balance interest</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-bold text-slate-800">21 to 30 Weeks (Tier 3)</td>
                  <td className="px-4 py-2.5 text-amber-600 font-bold">25% Discount</td>
                  <td className="px-4 py-2.5 text-slate-700">75% of balance interest</td>
                  <td className="px-4 py-2.5 text-slate-500 font-sans">Remaining Principal + 75% of balance interest</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-bold text-slate-800">31+ Weeks (Tier 4)</td>
                  <td className="px-4 py-2.5 text-slate-500 font-bold">0% Discount</td>
                  <td className="px-4 py-2.5 text-slate-700">100% of balance interest</td>
                  <td className="px-4 py-2.5 text-slate-500 font-sans">Remaining Principal + 100% of balance interest</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Organization Metadata */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Organization Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company / Organization Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Registered Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{updateMutation.isPending ? 'Saving...' : 'Save Configuration Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
