"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { API_BASE_URL, apiRequest } from "../../lib/api";
import { uploadToCloudinary } from "../../lib/cloudinary";
import { io, Socket } from "socket.io-client";
import {
  MessageSquare,
  Send,
  Radio,
  Search,
  Users,
  Shield,
  Headphones,
  Check,
  CheckCheck,
  Paperclip,
  Image as ImageIcon,
  X,
  RefreshCw,
  Sparkles,
  Phone,
  Mail,
  Clock,
  AlertCircle,
  Megaphone,
  UserCheck,
  ChevronLeft,
} from "lucide-react";

type ITContact = {
  _id: string;
  id: string;
  username: string;
  displayName: string;
  email?: string;
  phone?: string;
  role: string;
  supportType?: string;
  avatarUrl?: string;
  lastActiveAt?: string;
  chatId?: string;
  lastMessage?: {
    content?: string;
    createdAt?: string;
    sender?: {
      displayName?: string;
      username?: string;
      role?: string;
    };
  };
  unreadCount?: number;
};

type Message = {
  _id: string;
  chat: string;
  sender: {
    _id: string;
    displayName?: string;
    username?: string;
    avatarUrl?: string;
    role?: string;
  };
  content: string;
  attachment?: string;
  readBy?: string[];
  createdAt: string;
};

export default function CommunicationPage() {
  const [contacts, setContacts] = useState<ITContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selectedContact, setSelectedContact] = useState<ITContact | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "support" | "management" | "admin">("all");

  // Broadcast Modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState<"all" | "support" | "management">("all");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Status & Socket
  const [socketConnected, setSocketConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // Current admin ID from storage
  const currentAdminUser = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const u = localStorage.getItem("admin_user");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }, []);

  // Auto-clear alert
  useEffect(() => {
    if (statusMsg) {
      const t = setTimeout(() => setStatusMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [statusMsg]);

  // Scroll messages to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [messages]);

  // ─── Socket.IO Setup ────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("join_channel", "admin_channel");
      socket.emit("join_channel", "support_channel");
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    // Handle incoming messages
    const handleIncomingMessage = (newMsg: Message) => {
      if (!newMsg) return;

      const currentOpenChatId = activeChatIdRef.current;
      const isCurrentlyOpen =
        Boolean(currentOpenChatId) &&
        (newMsg.chat === currentOpenChatId || (newMsg as any).chatId === currentOpenChatId);

      // If belongs to the currently open chat, append and mark read
      if (isCurrentlyOpen && currentOpenChatId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        apiRequest(`/api/chats/${currentOpenChatId}/read`, { method: "PUT" }).catch(() => {});
      }

      // Update contacts list last message, unread count, and move active sender to top
      setContacts((prev) => {
        let matchedIndex = -1;
        const updated = prev.map((c, index) => {
          const isThisChat = c.chatId === newMsg.chat || (c.id === newMsg.sender?._id && !c.chatId);
          if (isThisChat) {
            matchedIndex = index;
            const newUnread = isCurrentlyOpen ? 0 : (Number(c.unreadCount) || 0) + 1;
            return {
              ...c,
              chatId: c.chatId || newMsg.chat,
              lastMessage: {
                content: newMsg.content,
                createdAt: newMsg.createdAt,
                sender: newMsg.sender,
              },
              unreadCount: newUnread,
            };
          }
          return c;
        });

        // Move the recently messaged contact to the top
        let reordered = updated;
        if (matchedIndex > 0) {
          const [moved] = updated.splice(matchedIndex, 1);
          reordered = [moved, ...updated];
        }

        // Compute total unread across all contacts and notify global layout
        const totalUnread = reordered.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("it_unread_count_updated", { detail: totalUnread }));
        }

        return reordered;
      });
    };

    socket.on("message_received", handleIncomingMessage);
    socket.on("new_message", handleIncomingMessage);

    return () => {
      socket.disconnect();
    };
  }, []);

  // ─── Fetch Contacts ─────────────────────────────────────────────────────────
  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const data = await apiRequest("/api/chats/it-contacts");
      if (Array.isArray(data)) {
        setContacts(data);
        const totalUnread = data.reduce((sum: number, c: any) => sum + (Number(c.unreadCount) || 0), 0);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("it_unread_count_updated", { detail: totalUnread }));
        }
      }
    } catch (err: any) {
      console.warn("Contacts fetch notice:", err.message);
      setStatusMsg({ text: "Could not load contacts: " + err.message, type: "error" });
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // ─── Select Contact & Open Direct Chat ──────────────────────────────────────
  const handleSelectContact = async (contact: ITContact) => {
    setSelectedContact(contact);
    setLoadingMessages(true);
    setMessages([]);

    try {
      // Access or create IT communication chat
      const chatRes = await apiRequest("/api/chats", {
        method: "POST",
        body: JSON.stringify({
          userId: contact._id || contact.id,
          isITCommunication: true,
        }),
      });

      const chatId = chatRes._id || chatRes.id;
      setActiveChatId(chatId);
      activeChatIdRef.current = chatId;

      // Join chat room over Socket.IO
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("join_chat", chatId);
      }

      // Fetch chat messages
      const msgs = await apiRequest(`/api/messages/${chatId}`);
      if (Array.isArray(msgs)) {
        setMessages(msgs);
      }

      // Mark as read in backend
      await apiRequest(`/api/chats/${chatId}/read`, { method: "PUT" }).catch(() => {});

      // Clear unread badge for this contact in contact list and sync global count
      setContacts((prev) => {
        const nextList = prev.map((c) =>
          c.id === contact.id || c._id === contact._id || c.chatId === chatId
            ? { ...c, unreadCount: 0, chatId }
            : c
        );
        const totalUnread = nextList.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("it_unread_count_updated", { detail: totalUnread }));
        }
        return nextList;
      });
    } catch (err: any) {
      setStatusMsg({ text: "Failed to open chat: " + err.message, type: "error" });
    } finally {
      setLoadingMessages(false);
    }
  };

  // ─── Handle File / Attachment ───────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentFile(file);
    const reader = new FileReader();
    reader.onload = () => setAttachmentPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Send Message ───────────────────────────────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!messageText.trim() && !attachmentFile) || !activeChatId || sendingMessage) return;

    setSendingMessage(true);
    try {
      let attachmentUrl = "";
      if (attachmentFile) {
        setUploadingAttachment(true);
        try {
          attachmentUrl = await uploadToCloudinary(attachmentFile, "it_chat_attachments");
        } catch (uploadErr: any) {
          setStatusMsg({ text: "Attachment upload failed: " + uploadErr.message, type: "error" });
          setSendingMessage(false);
          setUploadingAttachment(false);
          return;
        } finally {
          setUploadingAttachment(false);
        }
      }

      const res = await apiRequest("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          chatId: activeChatId,
          content: messageText.trim(),
          attachment: attachmentUrl,
        }),
      });

      // Append locally
      setMessages((prev) => [...prev, res]);
      setMessageText("");
      removeAttachment();

      // Emit over socket
      if (socketRef.current) {
        socketRef.current.emit("new_message", res);
      }

      // Update contact's last message
      if (selectedContact) {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === selectedContact.id
              ? {
                  ...c,
                  lastMessage: {
                    content: res.content,
                    createdAt: res.createdAt,
                    sender: res.sender,
                  },
                }
              : c
          )
        );
      }
    } catch (err: any) {
      setStatusMsg({ text: "Failed to send message: " + err.message, type: "error" });
    } finally {
      setSendingMessage(false);
    }
  };

  // ─── Broadcast to All Management / Support ─────────────────────────────────
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastContent.trim() || sendingBroadcast) return;

    setSendingBroadcast(true);
    try {
      const res = await apiRequest("/api/chats/it-broadcast", {
        method: "POST",
        body: JSON.stringify({
          content: broadcastContent.trim(),
          targetRole: broadcastTarget,
        }),
      });

      setStatusMsg({
        text: `📢 IT Broadcast sent successfully to ${res.sentCount || "all"} staff accounts!`,
        type: "success",
      });
      setShowBroadcastModal(false);
      setBroadcastContent("");
      // Refresh contacts to show latest broadcast
      fetchContacts();
    } catch (err: any) {
      setStatusMsg({ text: "Broadcast failed: " + err.message, type: "error" });
    } finally {
      setSendingBroadcast(false);
    }
  };

  // ─── Filtered Contacts ──────────────────────────────────────────────────────
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Role filter
      if (roleFilter === "support") {
        const isSupport = c.role === "support" || !!c.supportType || /support|reception|kitchen|service/i.test(c.username);
        if (!isSupport) return false;
      } else if (roleFilter === "management") {
        const isMgmt = c.role === "management" || /manager|management/i.test(c.username);
        if (!isMgmt) return false;
      } else if (roleFilter === "admin") {
        const isAdmin = c.role === "admin" || c.role === "super_admin";
        if (!isAdmin) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (c.displayName || "").toLowerCase().includes(q);
        const matchesUser = (c.username || "").toLowerCase().includes(q);
        const matchesEmail = (c.email || "").toLowerCase().includes(q);
        const matchesRole = (c.role || "").toLowerCase().includes(q);
        const matchesType = (c.supportType || "").toLowerCase().includes(q);
        return matchesName || matchesUser || matchesEmail || matchesRole || matchesType;
      }

      return true;
    });
  }, [contacts, roleFilter, searchQuery]);

  return (
    <>
      <style>{`
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }
        .live-dot {
          width: 8px; height: 8px; border-radius: 50%; background: #10B981;
          display: inline-block; animation: pulseDot 1.8s infinite ease-in-out;
        }
        .contact-item:hover {
          background: #F1F5F9;
        }
        .contact-item.active {
          background: #EFF6FF;
          border-left: 3.5px solid #2563EB;
        }
      `}</style>

      <div style={{ display: "grid", gap: 20 }}>

        {/* ── Page Header ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
              <Headphones size={24} color="#FF7F50" />
              IT Department Communication Space
            </h2>
            <p style={{ margin: 0, color: "#64748B", fontSize: 14 }}>
              Direct console for IT & Management to communicate with support and administration. Staff receive all messages as official IT Department chats.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Live Socket Sync Badge */}
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              background: socketConnected ? "#ECFDF5" : "#FEF2F2",
              border: `1px solid ${socketConnected ? "#A7F3D0" : "#FECACA"}`,
              padding: "7px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
              color: socketConnected ? "#065F46" : "#991B1B",
            }}>
              <span className="live-dot" style={{ background: socketConnected ? "#10B981" : "#EF4444" }} />
              {socketConnected ? "Real-Time Sync Active" : "Connecting..."}
            </div>

            {/* Broadcast Button */}
            <button
              onClick={() => setShowBroadcastModal(true)}
              style={{
                background: "linear-gradient(135deg, #FF6B4A 0%, #E04826 100%)",
                color: "#fff", border: "none", padding: "9px 16px", borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 7,
                boxShadow: "0 4px 14px rgba(224, 72, 38, 0.28)",
              }}
            >
              <Megaphone size={15} />
              Broadcast to All Staff
            </button>
          </div>
        </div>

        {/* ── Status Alert ──────────────────────────────────────────────────── */}
        {statusMsg && (
          <div style={{
            background: statusMsg.type === "success" ? "#ECFDF5" : "#FEF2F2",
            border: `1px solid ${statusMsg.type === "success" ? "#A7F3D0" : "#FECACA"}`,
            color: statusMsg.type === "success" ? "#065F46" : "#991B1B",
            padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {statusMsg.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
            {statusMsg.text}
          </div>
        )}

        {/* ── Main Chat Workspace Layout ─────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          gap: 16,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
          border: "1px solid #E2E8F0",
          minHeight: "72vh",
          overflow: "hidden",
        }}>

          {/* ════ LEFT COLUMN: CONTACTS DIRECTORY ════ */}
          <div style={{ borderRight: "1px solid #E2E8F0", display: "flex", flexDirection: "column", background: "#FAFBFD" }}>

            {/* Console Badge & Search */}
            <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#1E293B", letterSpacing: 0.4, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Staff Channels ({filteredContacts.length})
                  {contacts.reduce((acc, c) => acc + (Number(c.unreadCount) || 0), 0) > 0 && (
                    <span style={{ background: "#EF4444", color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 999 }}>
                      {contacts.reduce((acc, c) => acc + (Number(c.unreadCount) || 0), 0)} unread
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 11, background: "#1E293B", color: "#FF7F50", fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>
                  IT Admin
                </span>
              </div>

              {/* Search */}
              <div style={{ position: "relative" }}>
                <Search size={14} color="#94A3B8" style={{ position: "absolute", left: 10, top: 11 }} />
                <input
                  type="text"
                  placeholder="Search staff by name or dept..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 10px 8px 32px",
                    borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12,
                    background: "#fff", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Role Filter Chips */}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {(["all", "support", "management", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    style={{
                      border: "none",
                      padding: "4px 9px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "capitalize",
                      background: roleFilter === r ? "#0F172A" : "#F1F5F9",
                      color: roleFilter === r ? "#fff" : "#64748B",
                      transition: "all 0.15s",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Contacts List Scroll Area */}
            <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
              {loadingContacts ? (
                <div style={{ textAlign: "center", padding: 30, color: "#94A3B8", fontSize: 13 }}>
                  Loading staff contacts...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "#94A3B8", fontSize: 13 }}>
                  No management or support accounts match your filter.
                </div>
              ) : (
                filteredContacts.map((contact) => {
                  const isSelected = selectedContact?.id === contact.id;
                  const isSupport = contact.role === "support" || !!contact.supportType;
                  const isMgmt = contact.role === "management";
                  const roleLabel = isSupport
                    ? contact.supportType ? `${contact.supportType} Support` : "Support Staff"
                    : isMgmt
                    ? "Management"
                    : "Admin";
                  const hasUnread = Boolean(contact.unreadCount && contact.unreadCount > 0);

                  return (
                    <div
                      key={contact.id}
                      onClick={() => handleSelectContact(contact)}
                      className={`contact-item ${isSelected ? "active" : ""}`}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        marginBottom: 4,
                        transition: "all 0.15s",
                        background: isSelected ? "#F1F5F9" : hasUnread ? "#FEF2F2" : "transparent",
                        borderLeft: hasUnread && !isSelected ? "3.5px solid #EF4444" : "3.5px solid transparent",
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 42, height: 42, borderRadius: "50%",
                        background: isSupport ? "#FFF7ED" : isMgmt ? "#F5F3FF" : "#EFF6FF",
                        border: `1.5px solid ${isSupport ? "#FDBA74" : isMgmt ? "#C4B5FD" : "#93C5FD"}`,
                        overflow: "hidden", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 15,
                        color: isSupport ? "#EA580C" : isMgmt ? "#7C3AED" : "#2563EB",
                      }}>
                        {contact.avatarUrl ? (
                          <img src={contact.avatarUrl} alt={contact.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          (contact.displayName || contact.username || "S").slice(0, 2).toUpperCase()
                        )}
                      </div>

                      {/* Info & Last Message */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {contact.displayName || contact.username}
                          </span>
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 4, textTransform: "capitalize",
                            background: isSupport ? "#FEF3C7" : isMgmt ? "#EDE9FE" : "#DBEAFE",
                            color: isSupport ? "#B45309" : isMgmt ? "#6D28D9" : "#1D4ED8",
                          }}>
                            {roleLabel}
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                          <div style={{
                            fontSize: 11.5,
                            color: hasUnread ? "#B91C1C" : "#64748B",
                            fontWeight: hasUnread ? 700 : 400,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 175,
                          }}>
                            {contact.lastMessage?.content ? contact.lastMessage.content : `@${contact.username}`}
                          </div>

                          {/* Unread badge */}
                          {hasUnread && (
                            <span style={{
                              background: "#EF4444", color: "#fff",
                              fontSize: 10.5, fontWeight: 800,
                              minWidth: 20, height: 20, borderRadius: 999,
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              padding: "0 6px",
                              boxShadow: "0 2px 6px rgba(239, 68, 68, 0.4)",
                              flexShrink: 0,
                              marginLeft: 6,
                            }}>
                              {(contact.unreadCount || 0) > 99 ? "99+" : contact.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Refresh */}
            <div style={{ padding: "10px 14px", borderTop: "1px solid #E2E8F0", textAlign: "center" }}>
              <button
                onClick={fetchContacts}
                style={{
                  background: "none", border: "none", color: "#64748B", fontSize: 12,
                  fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
                }}
              >
                <RefreshCw size={12} /> Refresh Channels
              </button>
            </div>
          </div>

          {/* ════ RIGHT COLUMN: CONVERSATION PANE ════ */}
          <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#FFFFFF" }}>
            {selectedContact ? (
              <>
                {/* Chat Header */}
                <div style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "#F8FAFC",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: "#0F172A", color: "#FF7F50",
                      fontWeight: 800, fontSize: 16,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden", border: "2px solid #FF7F50",
                    }}>
                      {selectedContact.avatarUrl ? (
                        <img src={selectedContact.avatarUrl} alt={selectedContact.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        (selectedContact.displayName || "S").slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                        {selectedContact.displayName || selectedContact.username}
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                          background: "#EFF6FF", color: "#1D4ED8",
                        }}>
                          @{selectedContact.username}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, display: "flex", alignItems: "center", gap: 12 }}>
                        <span>Role: <strong>{selectedContact.role.toUpperCase()}</strong></span>
                        {selectedContact.phone && <span>· 📞 {selectedContact.phone}</span>}
                        {selectedContact.email && <span>· ✉️ {selectedContact.email}</span>}
                      </div>
                    </div>
                  </div>

                  {/* IT Channel Badge */}
                  <div style={{
                    background: "#0F172A", color: "#fff",
                    padding: "6px 12px", borderRadius: 8,
                    fontSize: 11, fontWeight: 800, letterSpacing: 0.4,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <Shield size={13} color="#FF7F50" />
                    IT Channel · Secure
                  </div>
                </div>

                {/* Info Callout */}
                <div style={{
                  background: "#EFF6FF", borderBottom: "1px solid #BFDBFE",
                  padding: "8px 20px", fontSize: 11.5, color: "#1E40AF",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <Sparkles size={14} color="#2563EB" />
                  <span>
                    Official IT Channel: Messages sent from this console are branded to staff as direct updates from the <strong>IT Department</strong>.
                  </span>
                </div>

                {/* Messages Scroll Area */}
                <div style={{
                  flex: 1, overflowY: "auto", padding: "20px 24px",
                  display: "flex", flexDirection: "column", gap: 14,
                  background: "#F8FAFC", minHeight: "360px", maxHeight: "58vh",
                }}>
                  {loadingMessages ? (
                    <div style={{ textAlign: "center", padding: 40, color: "#64748B", fontSize: 13 }}>
                      Loading conversation history...
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40, color: "#94A3B8" }}>
                      <MessageSquare size={36} color="#CBD5E1" style={{ margin: "0 auto 10px" }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>No messages exchanged yet.</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12 }}>Send a message below to start communicating with this staff member.</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isFromAdmin =
                        msg.sender?.role === "admin" ||
                        msg.sender?.role === "super_admin" ||
                        msg.sender?._id === currentAdminUser?.id ||
                        msg.sender?._id === currentAdminUser?._id;

                      const timeStr = msg.createdAt
                        ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "";

                      return (
                        <div
                          key={msg._id}
                          style={{
                            alignSelf: isFromAdmin ? "flex-end" : "flex-start",
                            maxWidth: "75%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: isFromAdmin ? "flex-end" : "flex-start",
                          }}
                        >
                          {/* Sender Label */}
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748B", marginBottom: 3, display: "flex", alignItems: "center", gap: 5 }}>
                            {isFromAdmin ? (
                              <>
                                <span style={{ background: "#0F172A", color: "#FF7F50", padding: "1px 6px", borderRadius: 3, fontSize: 9.5 }}>
                                  IT DEPARTMENT
                                </span>
                                <span>{msg.sender?.displayName || "Administrator"}</span>
                              </>
                            ) : (
                              <span>{msg.sender?.displayName || selectedContact.displayName || "Staff Member"}</span>
                            )}
                          </div>

                          {/* Message Bubble */}
                          <div style={{
                            padding: "10px 14px",
                            borderRadius: 14,
                            borderBottomRightRadius: isFromAdmin ? 3 : 14,
                            borderBottomLeftRadius: isFromAdmin ? 14 : 3,
                            background: isFromAdmin
                              ? "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)"
                              : "#FFFFFF",
                            color: isFromAdmin ? "#FFFFFF" : "#0F172A",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                            border: isFromAdmin ? "none" : "1px solid #E2E8F0",
                            fontSize: 13.5,
                            lineHeight: 1.45,
                            wordBreak: "break-word",
                            whiteSpace: "pre-wrap",
                          }}>
                            {/* Attachment if present */}
                            {msg.attachment && (
                              <div style={{ marginBottom: 8 }}>
                                <img
                                  src={msg.attachment}
                                  alt="Attachment"
                                  onClick={() => window.open(msg.attachment, "_blank")}
                                  style={{
                                    maxWidth: "100%", maxHeight: 220,
                                    borderRadius: 8, cursor: "pointer", objectFit: "cover",
                                  }}
                                />
                              </div>
                            )}

                            {msg.content}
                          </div>

                          {/* Timestamp */}
                          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={10} />
                            <span>{timeStr}</span>
                            {isFromAdmin && <CheckCheck size={12} color="#3B82F6" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Attachment Preview (if selected) */}
                {attachmentPreview && (
                  <div style={{
                    padding: "8px 20px", background: "#FEF2F2", borderTop: "1px solid #FECACA",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img src={attachmentPreview} alt="Preview" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} />
                      <span style={{ fontSize: 12, color: "#991B1B", fontWeight: 600 }}>{attachmentFile?.name}</span>
                    </div>
                    <button onClick={removeAttachment} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Message Input Bar */}
                <form
                  onSubmit={handleSendMessage}
                  style={{
                    padding: "12px 18px",
                    borderTop: "1px solid #E2E8F0",
                    background: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: "#F1F5F9", border: "none", borderRadius: 8,
                      padding: "9px 11px", cursor: "pointer", color: "#475569",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    title="Attach image"
                  >
                    <Paperclip size={17} />
                  </button>

                  <textarea
                    rows={1}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Type message to ${selectedContact.displayName || selectedContact.username} as IT Department...`}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13.5,
                      outline: "none",
                      resize: "none",
                      fontFamily: "inherit",
                    }}
                  />

                  <button
                    type="submit"
                    disabled={(!messageText.trim() && !attachmentFile) || sendingMessage || uploadingAttachment}
                    style={{
                      background: (!messageText.trim() && !attachmentFile) || sendingMessage ? "#CBD5E1" : "#0F172A",
                      color: "#fff",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: (!messageText.trim() && !attachmentFile) || sendingMessage ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {sendingMessage ? "Sending..." : (
                      <>
                        <Send size={14} /> Send
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              /* No Contact Selected Empty State */
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center",
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%", background: "#EFF6FF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16, border: "2px solid #BFDBFE",
                }}>
                  <Headphones size={32} color="#2563EB" />
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#0F172A" }}>
                  Select a Staff Channel to Begin
                </h3>
                <p style={{ margin: "0 0 20px", color: "#64748B", fontSize: 13.5, maxWidth: 420 }}>
                  Select any Management or Support account on the left to start a real-time communication session, or broadcast an urgent announcement to all staff.
                </p>
                <button
                  onClick={() => setShowBroadcastModal(true)}
                  style={{
                    background: "#0F172A", color: "#FF7F50", border: "none",
                    padding: "10px 20px", borderRadius: 10, fontWeight: 700,
                    fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
                  }}
                >
                  <Megaphone size={15} /> Broadcast Official Notice
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── BROADCAST MODAL ──────────────────────────────────────────────── */}
        {showBroadcastModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            display: "flex", justifyContent: "center", alignItems: "center",
            zIndex: 1000, backdropFilter: "blur(6px)", padding: 20,
          }}>
            <div style={{
              background: "#fff", padding: 24, borderRadius: 18,
              width: "100%", maxWidth: 540, boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #E2E8F0", paddingBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Megaphone size={18} color="#FF7F50" />
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Broadcast IT Department Notice</h3>
                </div>
                <button onClick={() => setShowBroadcastModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSendBroadcast} style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Target Audience
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[
                      { id: "all", label: "All Staff" },
                      { id: "support", label: "Support Only" },
                      { id: "management", label: "Management Only" },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => setBroadcastTarget(opt.id as any)}
                        style={{
                          padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                          border: broadcastTarget === opt.id ? "2px solid #2563EB" : "1px solid #CBD5E1",
                          background: broadcastTarget === opt.id ? "#EFF6FF" : "#F8FAFC",
                          color: broadcastTarget === opt.id ? "#1D4ED8" : "#475569",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Notice Content *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={broadcastContent}
                    onChange={(e) => setBroadcastContent(e.target.value)}
                    placeholder="Enter urgent system announcement, policy update, or notice from IT Department..."
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 8,
                      border: "1px solid #CBD5E1", fontSize: 13, outline: "none",
                      boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                    Recipients will receive this message as: <em>📢 [IT Department Notice]</em>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowBroadcastModal(false)}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#fff", cursor: "pointer", fontSize: 13 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!broadcastContent.trim() || sendingBroadcast}
                    style={{
                      background: "linear-gradient(135deg, #FF6B4A 0%, #E04826 100%)",
                      color: "#fff", border: "none", padding: "8px 20px", borderRadius: 8,
                      fontWeight: 700, fontSize: 13, cursor: sendingBroadcast ? "not-allowed" : "pointer",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {sendingBroadcast ? "Broadcasting..." : "Send Announcement"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
