"use client";

import { Button } from "@/components/ui/button";
import { useAuth, useOrg } from "@/contexts/auth.context";
import { useI18n } from "@/i18n";
import {
  createOrganization,
  getOrganizationById,
  getUsersByOrgId,
  joinOrganization,
  updateOrganization,
} from "@/services/clients.service";
import { Copy, CopyCheck, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
}

export default function OrgManagementModal({ onClose }: Props) {
  const { user } = useAuth();
  const { organization } = useOrg();
  const { t } = useI18n();

  const [orgName, setOrgName] = useState(organization?.name ?? "");
  const [orgImage, setOrgImage] = useState(organization?.imageUrl ?? "");
  const [members, setMembers] = useState<{ id: string; email: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("图片不能超过 2MB", { position: "bottom-right", duration: 3000 });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setOrgImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const inviteLink =
    typeof window !== "undefined" && organization?.id
      ? `${window.location.origin}/join/${organization.id}`
      : "";

  useEffect(() => {
    if (!organization?.id) return;
    getOrganizationById(organization.id).then((data) => {
      if (data) {
        setOrgName(data.name ?? "");
        setOrgImage(data.image_url ?? "");
      }
    });
    getUsersByOrgId(organization.id).then((data) => {
      setMembers(data as any[]);
    });
  }, [organization?.id]);

  const handleSave = async () => {
    if (!organization?.id) return;
    setSaving(true);
    await updateOrganization(
      { name: orgName.trim(), image_url: orgImage.trim() || null },
      organization.id,
    );
    setSaving(false);
    toast.success(t("orgManagement.saveSuccess"), { position: "bottom-right", duration: 3000 });
    window.location.href = "/api/auth/refresh";
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      toast.success(t("orgManagement.linkCopied"), { position: "bottom-right", duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim() || !user?.id) return;
    setCreating(true);
    const org = await createOrganization(newOrgName.trim());
    if (org) {
      const result = await joinOrganization(user.id, org.id);
      if (result.success) {
        toast.success(t("orgManagement.saveSuccess"), { position: "bottom-right", duration: 3000 });
        window.location.href = "/api/auth/refresh";
      }
    } else {
      toast.error(t("orgManagement.saveFailed"), { position: "bottom-right", duration: 3000 });
    }
    setCreating(false);
  };

  return (
    <div className="w-[480px] p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">{t("orgManagement.title")}</h2>
      </div>

      {!organization?.id ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">{t("orgManagement.noOrg")}</p>
          <label className="block text-sm font-medium text-gray-700">
            {t("orgManagement.createNew")}
          </label>
          <input
            type="text"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder={t("orgManagement.orgNamePlaceholder")}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button
            onClick={handleCreateOrg}
            disabled={creating || !newOrgName.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-sm w-full mt-1 font-bold"
          >
            {t("orgManagement.createOrg")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("orgManagement.orgName")}
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={t("orgManagement.orgNamePlaceholder")}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("orgManagement.orgImage")}
            </label>
            <div className="flex items-center gap-3">
              {orgImage ? (
                <img
                  src={orgImage}
                  alt="org logo"
                  className="w-12 h-12 rounded-lg object-cover border shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
                  <Upload size={18} className="text-gray-400" />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 text-gray-700"
              >
                {orgImage ? "更换图片" : "上传图片"}
              </button>
              {orgImage && (
                <button
                  type="button"
                  onClick={() => setOrgImage("")}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  删除
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">支持 JPG / PNG / GIF，最大 2MB</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="text-sm">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-sm font-bold"
            >
              {t("common.save")}
            </Button>
          </div>

          <hr className="my-1" />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{t("orgManagement.inviteTitle")}</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 border rounded-md px-3 py-2 text-xs bg-gray-50 text-gray-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1 px-3 py-2 text-sm border rounded-md hover:bg-gray-50 text-indigo-600"
              >
                {copied ? <CopyCheck size={15} /> : <Copy size={15} />}
                {t("orgManagement.copyLink")}
              </button>
            </div>
          </div>

          {members.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{t("orgManagement.members")}</p>
              <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center px-3 py-2 text-sm gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-medium shrink-0">
                      {(m.name || m.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      {m.name && <span className="font-medium truncate">{m.name}</span>}
                      <span className="text-gray-500 truncate text-xs">{m.email}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
