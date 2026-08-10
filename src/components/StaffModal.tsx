import React, { useState } from 'react';
import { Language, Shop, ShopMember, UserRole } from '../types';
import { translations } from '../i18n/translations';
import { getRoleLabel } from '../lib/permissions';
import {
  Users,
  X,
  CheckCircle2,
  UserPlus,
  Shield,
  Trash2,
  Crown,
  UserCheck,
  Check,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface Props {
  shop: Shop;
  language: Language;
  onClose: () => void;
}

export const StaffModal: React.FC<Props> = ({ shop, language, onClose }) => {
  const t = translations[language];

  // Initial Mock Members list for active shop
  const [members, setMembers] = useState<ShopMember[]>([
    {
      id: 'mem-1',
      shop_id: shop.id,
      user_id: shop.owner_id,
      role: 'owner',
      user_name: shop.owner_name || 'Shop Owner',
      user_phone: shop.phone || '+8801700000000',
      status: 'active',
      created_at: new Date().toISOString(),
    },
    {
      id: 'mem-2',
      shop_id: shop.id,
      user_id: 'user-manager-1',
      role: 'manager',
      user_name: 'Tanvir Hossain',
      user_phone: '+8801812345678',
      status: 'active',
      created_at: new Date().toISOString(),
    },
  ]);

  const [isInviting, setIsInviting] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [successMsg, setSuccessMsg] = useState('');

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const newMember: ShopMember = {
      id: `mem-${Date.now()}`,
      shop_id: shop.id,
      user_id: `user-${Date.now()}`,
      role: selectedRole,
      user_name: name.trim(),
      user_phone: phone.trim(),
      status: 'active',
      created_at: new Date().toISOString(),
    };

    setMembers([...members, newMember]);
    setSuccessMsg(`👤 Invited ${name} as ${getRoleLabel(selectedRole)}!`);
    setName('');
    setPhone('');
    setIsInviting(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleRoleChange = (memberId: string, newRole: UserRole) => {
    setMembers(
      members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    setSuccessMsg(`Updated staff permission role!`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleRemoveMember = (memberId: string) => {
    setMembers(members.filter((m) => m.id !== memberId));
    setSuccessMsg(`Removed staff access.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-indigo-600 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-xl tracking-tight">Staff & Role Permissions</h3>
              <p className="text-xs text-indigo-100 font-medium mt-0.5">
                Role-Based Access Control (RBAC) for cashiers & managers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-4 py-3 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          {!isInviting ? (
            <>
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                  Active Team Members ({members.length})
                </h4>
                <button
                  onClick={() => setIsInviting(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/30 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Staff Member</span>
                </button>
              </div>

              {/* Roster List */}
              <div className="space-y-3">
                {members.map((m) => {
                  const isOwner = m.role === 'owner';
                  return (
                    <div
                      key={m.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center justify-between space-x-2 shadow-xs"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm ${
                            isOwner
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-600'
                              : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600'
                          }`}
                        >
                          {isOwner ? <Crown className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h5 className="font-extrabold text-slate-900 dark:text-white text-sm">
                              {m.user_name}
                            </h5>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {m.user_phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isOwner ? (
                          <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold text-xs px-2.5 py-1 rounded-xl flex items-center">
                            <Crown className="w-3.5 h-3.5 mr-1" />
                            Owner
                          </span>
                        ) : (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as UserRole)}
                            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-600 outline-none"
                          >
                            <option value="admin">Administrator 🛡️</option>
                            <option value="manager">Manager 👔</option>
                            <option value="staff">Staff / Cashier 🧑‍💼</option>
                            <option value="viewer">Viewer 👁️</option>
                          </select>
                        )}

                        {!isOwner && (
                          <button
                            onClick={() => handleRemoveMember(m.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-colors"
                            title="Remove Staff"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Invite Staff Member Inline Form */
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm uppercase tracking-wide">
                  Invite Staff Member
                </h4>
                <button
                  type="button"
                  onClick={() => setIsInviting(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tanvir Ahmed"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl border border-gray-300 dark:border-slate-600 font-bold text-sm outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+8801700000000"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl border border-gray-300 dark:border-slate-600 font-bold text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assign Permission Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl border border-gray-300 dark:border-slate-600 font-bold text-sm outline-none"
                >
                  <option value="admin">Administrator 🛡️ (Can edit profile, add transactions & void entries)</option>
                  <option value="manager">Store Manager 👔 (Can manage customers & add/void transactions)</option>
                  <option value="staff">Staff / Cashier 🧑‍💼 (Can add customers & record transactions)</option>
                  <option value="viewer">Auditor / Viewer 👁️ (Read-only view of dashboard & reports)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all"
              >
                <span>Send Staff Invitation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Role-Based Access Control (RBAC) Active & Enforced</span>
          </div>
        </div>
      </div>
    </div>
  );
};
