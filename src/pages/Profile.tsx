// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Edit, Key, Shield, LogOut, CheckCircle, Camera, X, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { SecurityPolicyModal } from '../components/SecurityPolicyModal';
import { NativeDevicePermissionsModule } from '../components/daw/NativeDevicePermissionsModule';

export function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal active states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [isDevicePermissionsOpen, setIsDevicePermissionsOpen] = useState(false);

  // Profile Edit fields
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Async action state management
  const [profileActionLoading, setProfileActionLoading] = useState(false);
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const [profileActionSuccess, setProfileActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
      
      const { data: adminCheck } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      setIsAdmin(!!adminCheck);
    };
    
    fetchProfile();
  }, [user]);

  const handleOpenEditModal = () => {
    if (!profile) return;
    setEditUsername(profile.username || '');
    setEditFullName(profile.full_name || '');
    setEditBio(profile.bio || '');
    setEditPhoto(profile.profile_picture || '');
    setPhotoFile(null);
    setProfileActionError(null);
    setProfileActionSuccess(null);
    setIsEditModalOpen(true);
  };

  const handleOpenPasswordModal = () => {
    setNewPassword('');
    setConfirmPassword('');
    setProfileActionError(null);
    setProfileActionSuccess(null);
    setIsPasswordModalOpen(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Image size must be less than 2MB!");
      return;
    }

    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setEditPhoto(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileActionLoading(true);
    setProfileActionError(null);
    setProfileActionSuccess(null);

    try {
      let finalPhotoUrl = editPhoto;

      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop() || 'png';
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('profile_images')
          .upload(filePath, photoFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('profile_images')
          .getPublicUrl(filePath);

        finalPhotoUrl = publicUrl;
      }

      const updateData: any = {
        username: editUsername,
        full_name: editFullName,
        bio: editBio,
        profile_picture: finalPhotoUrl,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      // Reactively apply changes in real-time
      setProfile((prev: any) => ({
        ...prev,
        ...updateData
      }));

      setProfileActionSuccess("Profile details updated successfully!");
      setTimeout(() => {
        setIsEditModalOpen(false);
      }, 1200);
    } catch (err: any) {
      setProfileActionError(err?.message || "Failed to update profile info");
    } finally {
      setProfileActionLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileActionLoading(true);
    setProfileActionError(null);
    setProfileActionSuccess(null);

    if (newPassword !== confirmPassword) {
      setProfileActionError("Passwords do not match");
      setProfileActionLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setProfileActionError("Password must be at least 6 characters long");
      setProfileActionLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setProfileActionSuccess("Account password updated successfully!");
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsPasswordModalOpen(false);
      }, 1200);
    } catch (err: any) {
      setProfileActionError(err?.message || "Failed to update password");
    } finally {
      setProfileActionLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (!profile) return <div className="p-8 text-center animate-pulse">Loading...</div>;

  return (
    <div className="flex flex-col p-6 space-y-8 pb-10">
      <h1 className="text-2xl font-bold">Profile</h1>
      
      <div className="flex flex-col items-center">
        <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-2 border-fuchsia-500 shadow-[0_0_15px_#ec489955]">
          {profile.profile_picture ? (
            <img src={profile.profile_picture} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#222] flex items-center justify-center text-3xl font-bold">
              {profile.username?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        
        <div className="flex items-center text-xl font-bold">
          {profile.username || 'user'}
          {profile.is_verified && <CheckCircle size={16} className="text-blue-400 ml-1" fill="#60a5fa" color="black" />}
        </div>
        <div className="text-sm text-gray-400 mt-1">{profile.full_name}</div>
        <div className="text-xs text-gray-500">{user?.email}</div>
        
        <div className="flex items-center space-x-8 mt-6">
          <div className="text-center">
            <div className="font-bold text-lg">{profile.followers_count || 0}</div>
            <div className="text-[10px] text-gray-400">Followers</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg">{profile.following_count || 0}</div>
            <div className="text-[10px] text-gray-400">Following</div>
          </div>
        </div>
        
        {profile.bio && <p className="text-sm text-gray-300 mt-6 text-center px-4 max-w-sm">{profile.bio}</p>}
      </div>

      <div className="space-y-3 pt-4">
        <button 
          onClick={handleOpenEditModal}
          className="w-full flex items-center p-4 bg-[#141414] rounded-2xl border border-[#222] hover:bg-[#1A1A1A] transition text-left cursor-pointer"
        >
          <Edit size={18} className="text-fuchsia-400 mr-3" />
          <span className="font-semibold text-sm">Edit Profile</span>
        </button>
        <button 
          onClick={handleOpenPasswordModal}
          className="w-full flex items-center p-4 bg-[#141414] rounded-2xl border border-[#222] hover:bg-[#1A1A1A] transition text-left cursor-pointer"
        >
          <Key size={18} className="text-fuchsia-400 mr-3" />
          <span className="font-semibold text-sm">Change Password</span>
        </button>
        {isAdmin && (
          <button onClick={() => navigate('/admin')} className="w-full flex items-center p-4 bg-[#141414] rounded-2xl border border-[#222] hover:bg-[#1A1A1A] transition text-left cursor-pointer">
            <Shield size={18} className="text-cyan-400 mr-3" />
            <span className="font-semibold text-sm">Admin Dashboard</span>
          </button>
        )}
        
        {/* Support integration button in the general profile settings list */}
        <a 
          id="contact-seevibe-profile"
          href="mailto:seevibehelp@gmail.com"
          className="w-full flex items-center p-4 bg-[#141414] rounded-2xl border border-[#222] hover:bg-[#1A1A1A] transition text-gray-400 hover:text-white"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-pulse mr-3.5" />
          <span className="font-semibold text-sm">See Vibe Contact</span>
          <span className="ml-auto font-mono text-xs text-gray-500">seevibehelp@gmail.com</span>
        </a>

        <button 
          id="btn-policy-profile"
          onClick={() => setIsPolicyOpen(true)}
          className="w-full flex items-center p-4 bg-[#141414] rounded-2xl border border-[#222]/80 hover:bg-[#1A1A1A] transition text-left text-fuchsia-400 hover:text-fuchsia-300 cursor-pointer"
        >
          <Shield size={18} className="mr-3" />
          <span className="font-semibold text-sm">Platform Manual & Security Policy</span>
          <span className="ml-auto font-mono text-[9px] uppercase tracking-wider bg-fuchsia-500/10 px-2 py-0.5 rounded border border-fuchsia-500/20">Read Manual</span>
        </button>

        <button 
          id="btn-device-permissions-profile"
          onClick={() => setIsDevicePermissionsOpen(!isDevicePermissionsOpen)}
          className="w-full flex items-center p-4 bg-[#141414] rounded-2xl border border-[#222]/80 hover:bg-[#1A1A1A] transition text-left cursor-pointer"
        >
          <ShieldCheck size={18} className="text-emerald-400 mr-3" />
          <span className="font-semibold text-sm text-white">Native Device Control & Permissions</span>
          <span className="ml-auto font-mono text-[9px] uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[#00FF5A]">
            {isDevicePermissionsOpen ? 'Hide Panel' : 'Manage Panel'}
          </span>
        </button>

        {isDevicePermissionsOpen && (
          <div className="bg-[#101012] p-5 rounded-2xl border border-zinc-850 mt-1 space-y-4 animate-in slide-in-from-top-3 duration-200">
            <NativeDevicePermissionsModule />
          </div>
        )}

        <button onClick={handleSignOut} className="w-full flex items-center p-4 bg-[#141414] rounded-2xl border border-[#222] hover:bg-[#1A1A1A] transition text-red-500 text-left mt-2 cursor-pointer">
          <LogOut size={18} className="mr-3" />
          <span className="font-semibold text-sm">Sign Out</span>
        </button>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0C0D0F] border border-[#222] rounded-[24px] w-full max-w-sm overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col relative p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Edit Profile Details</h2>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditProfileSubmit} className="space-y-4">
              {/* Profile Photo Selection Interface */}
              <div className="flex flex-col items-center mb-4">
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-fuchsia-500/50 shadow-[0_0_10px_#ec489933] group">
                  {editPhoto ? (
                    <img src={editPhoto} alt="Preview Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#1A1A1A] flex items-center justify-center text-xl font-bold">
                      {editUsername?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <label htmlFor="edit-photo-input" className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity cursor-pointer text-white">
                    <Camera size={16} className="mb-0.5" />
                    <span className="text-[9px] font-mono tracking-wider">Change</span>
                  </label>
                </div>
                <input 
                  type="file" 
                  id="edit-photo-input" 
                  accept="image/*" 
                  onChange={handlePhotoUpload} 
                  className="hidden" 
                />
                <label htmlFor="edit-photo-input" className="text-[10px] text-fuchsia-400 hover:text-fuchsia-300 font-mono mt-1.5 cursor-pointer uppercase tracking-widest font-bold">
                  Upload Profile Photo
                </label>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">Username</label>
                <input 
                  type="text" 
                  value={editUsername} 
                  onChange={e => setEditUsername(e.target.value)} 
                  className="w-full bg-[#141414] border border-[#222] rounded-xl px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none placeholder-gray-600 text-white" 
                  required 
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">Full Name</label>
                <input 
                  type="text" 
                  value={editFullName} 
                  onChange={e => setEditFullName(e.target.value)} 
                  className="w-full bg-[#141414] border border-[#222] rounded-xl px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none placeholder-gray-600 text-white" 
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">Bio</label>
                <textarea 
                  value={editBio} 
                  onChange={e => setEditBio(e.target.value)} 
                  rows={2}
                  className="w-full bg-[#141414] border border-[#222] rounded-xl px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none placeholder-gray-600 text-white resize-none" 
                />
              </div>

              {profileActionError && (
                <div className="text-xs text-red-400 text-center p-3 bg-red-950/25 border border-red-900/40 rounded-xl space-y-2">
                  <p className="font-semibold">{profileActionError}</p>
                  {profileActionError.includes("updated_at") && (
                    <div className="text-gray-300 text-[11px] text-left mt-2 border-t border-red-900/40 pt-2 space-y-1">
                      <span className="font-bold text-fuchsia-400 block mb-1">💡 Realtime Database Fix:</span>
                      <span>An active DB trigger requires an `updated_at` column in your `profiles` table. Paste and run this SQL in your Supabase SQL Editor:</span>
                      <pre className="bg-black/60 p-2 rounded text-[10px] text-cyan-300 font-mono select-all overflow-x-auto whitespace-pre-wrap mt-1 border border-zinc-800">
                        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
                      </pre>
                    </div>
                  )}
                </div>
              )}
              {profileActionSuccess && <p className="text-xs text-green-400 text-center font-bold">{profileActionSuccess}</p>}

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-transparent border border-[#222] hover:bg-white/5 rounded-xl font-semibold text-xs text-gray-400 hover:text-white transition uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={profileActionLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white rounded-xl font-semibold text-xs hover:opacity-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50 uppercase cursor-pointer"
                >
                  {profileActionLoading && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0C0D0F] border border-[#222] rounded-[24px] w-full max-w-sm overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col relative p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Change Password</h2>
              <button 
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-gray-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">New Password</label>
                <input 
                  type="password" 
                  placeholder="At least 6 characters"
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="w-full bg-[#141414] border border-[#222] rounded-xl px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none placeholder-gray-600 text-white" 
                  required 
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">Confirm New Password</label>
                <input 
                  type="password" 
                  placeholder="Re-enter password"
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  className="w-full bg-[#141414] border border-[#222] rounded-xl px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none placeholder-gray-600 text-white" 
                  required 
                />
              </div>

              {profileActionError && <p className="text-xs text-red-400 text-center">{profileActionError}</p>}
              {profileActionSuccess && <p className="text-xs text-green-400 text-center font-bold">{profileActionSuccess}</p>}

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 py-2.5 bg-transparent border border-[#222] hover:bg-white/5 rounded-xl font-semibold text-xs text-gray-400 hover:text-white transition uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={profileActionLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white rounded-xl font-semibold text-xs hover:opacity-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50 uppercase cursor-pointer"
                >
                  {profileActionLoading && <Loader2 size={13} className="animate-spin" />}
                  <span>Change Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SecurityPolicyModal isOpen={isPolicyOpen} onClose={() => setIsPolicyOpen(false)} />
    </div>
  );
}
