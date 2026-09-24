"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Switch,
  Skeleton,
} from "@fine-leads/ui";
import { US_STATES } from "@fine-leads/utils";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  Copy,
  Check,
  UserPlus,
  X,
  FileText,
} from "lucide-react";

interface AgentRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  city: string | null;
  brokerageName: string | null;
  isDeliverable: boolean;
  licenseNumber: string | null;
  verificationScore: number;
  dataSource: string | null;
  createdAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AgentsResponse {
  agents: AgentRow[];
  pagination: PaginationData;
}

interface ImportResult {
  importedCount: number;
  updatedCount: number;
  failedCount: number;
  errors: { row: number; message: string }[];
}

const PAGE_SIZE = 25;

function CopyButton({ text }: { text: string | null }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [text]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!text) return <span className="text-surface-300 dark:text-surface-600">—</span>;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-sm text-surface-700 dark:text-surface-200 hover:text-primary-600 dark:hover:text-primary-400 transition-colors max-w-[220px] truncate"
      title={text}
    >
      <span className="truncate">{text}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
      )}
    </button>
  );
}

function CsvColumnHint() {
  return (
    <div className="rounded-md bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-3">
      <p className="text-xs font-medium text-surface-500 mb-2">Expected CSV columns:</p>
      <div className="grid grid-cols-2 gap-1 text-xs text-surface-400 font-mono">
        <span>fullName *</span>
        <span>email</span>
        <span>phone</span>
        <span>state</span>
        <span>city</span>
        <span>brokerageName</span>
        <span>licenseNumber</span>
        <span>zipCode</span>
        <span>googlePlaceId</span>
      </div>
    </div>
  );
}

export default function AdminAgentsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("state") || "";

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState(initialFilter);
  const [deliverabilityFilter, setDeliverabilityFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | boolean>>({});

  const [deleteAgent, setDeleteAgent] = useState<AgentRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, string>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const agentsQuery = useQuery<AgentsResponse>({
    queryKey: ["admin-agents", search, stateFilter, deliverabilityFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("page", String(page));
      if (search) params.set("q", search);
      if (stateFilter) params.set("state", stateFilter);
      if (deliverabilityFilter !== "all") params.set("isDeliverable", deliverabilityFilter);

      const res = await fetch(`/api/admin/agents?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to fetch agents");
      }
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const body: Record<string, unknown> = {};
      const allowedFields = [
        "fullName",
        "email",
        "phone",
        "brokerageName",
        "city",
        "state",
        "zipCode",
        "isDeliverable",
        "verificationScore",
        "licenseNumber",
      ];
      for (const field of allowedFields) {
        if (field in data) {
          body[field] = data[field];
        }
      }
      const res = await fetch(`/api/admin/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to update agent");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      setEditOpen(false);
      setEditingAgent(null);
      toast.success("Agent updated successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await fetch(`/api/admin/agents/${agentId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to delete agent");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      setDeleteOpen(false);
      setDeleteAgent(null);
      toast.success("Agent deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (rows: Record<string, string>[]) => {
      const res = await fetch("/api/admin/agents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Import failed");
      }
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (result: ImportResult) => {
      queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      setImportOpen(false);
      setImportFile(null);
      setImportPreview([]);
      toast.success(
        `Imported ${result.importedCount}, updated ${result.updatedCount}, failed ${result.failedCount}`,
      );
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} row errors`, {
          description: result.errors
            .slice(0, 3)
            .map((e) => `Row ${e.row}: ${e.message}`)
            .join(", "),
          duration: 8000,
        });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const openEditDialog = useCallback((agent: AgentRow) => {
    setEditingAgent(agent);
    setEditForm({
      fullName: agent.fullName || "",
      email: agent.email || "",
      phone: agent.phone || "",
      brokerageName: agent.brokerageName || "",
      city: agent.city || "",
      state: agent.state || "",
      licenseNumber: agent.licenseNumber || "",
      isDeliverable: agent.isDeliverable,
    });
    setEditOpen(true);
  }, []);

  const handleEditFieldChange = useCallback(
    (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditForm((prev) => ({ ...prev, [field]: e.target.value }));
    },
    [],
  );

  const handleEditSwitchChange = useCallback((checked: boolean) => {
    setEditForm((prev) => ({ ...prev, isDeliverable: checked }));
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingAgent) {
      updateMutation.mutate({ id: editingAgent.id, data: editForm });
    }
  }, [editingAgent, editForm, updateMutation]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    parseCsv(file);
  }, []);

  const parseCsv = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length === 0) {
        toast.error("CSV file is empty");
        return;
      }

      const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === "\"") {
            if (inQuotes && i + 1 < line.length && line[i + 1] === "\"") {
              current += "\"";
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headerCells = parseRow(lines[0]);
      const headers = headerCells.map((h) => h.replace(/^["']|["']$/g, "").trim());

      const rows: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = parseRow(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
          if (header) {
            row[header] = (cells[idx] || "").replace(/^["']|["']$/g, "").trim();
          }
        });
        if (Object.keys(row).length > 0 && row.fullName) {
          rows.push(row);
        }
      }

      setImportPreview(rows.slice(0, 10));
      if (rows.length > 0) {
        setImportFile(file);
        toast.info(`Parsed ${rows.length} rows from CSV`);
      } else {
        toast.error("No valid rows found in CSV");
      }
    } catch {
      toast.error("Failed to parse CSV file");
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      setImportFile(file);
      parseCsv(file);
    } else {
      toast.error("Please upload a CSV file");
    }
  }, [parseCsv]);

  const handleStartImport = useCallback(() => {
    if (!importFile) return;
    const textPromise = importFile.text();
    textPromise.then((text) => {
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === "\"") {
            if (inQuotes && i + 1 < line.length && line[i + 1] === "\"") {
              current += "\"";
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headerCells = parseRow(lines[0]);
      const headers = headerCells.map((h) => h.replace(/^["']|["']$/g, "").trim());
      const rows: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = parseRow(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
          if (header) {
            row[header] = (cells[idx] || "").replace(/^["']|["']$/g, "").trim();
          }
        });
        if (Object.keys(row).length > 0 && row.fullName) {
          rows.push(row);
        }
      }
      importMutation.mutate(rows);
    }).catch(() => {
      toast.error("Failed to read CSV file");
    });
  }, [importFile, importMutation]);

  const isPending = updateMutation.isPending || deleteMutation.isPending;
  const data = agentsQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
            <Input
              placeholder="Search agents..."
              value={search}
              onChange={handleSearch}
              className="pl-9"
            />
          </div>
          <Select
            value={stateFilter}
            onValueChange={(v) => {
              setStateFilter(v === "ALL" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All States</SelectItem>
              {US_STATES.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={deliverabilityFilter}
            onValueChange={(v) => {
              setDeliverabilityFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Deliverability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="true">Deliverable</SelectItem>
              <SelectItem value="false">Undeliverable</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" disabled>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Agent
          </Button>
        </div>
      </div>

      {agentsQuery.isError && (
        <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-sm text-red-600 dark:text-red-400">
          {(agentsQuery.error as Error)?.message ?? "Failed to load agents"}
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <div className="rounded-md border border-surface-200 dark:border-surface-800">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>State / City</TableHead>
              <TableHead>Brokerage</TableHead>
              <TableHead>Deliverable</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {agentsQuery.isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : data?.agents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-surface-400 py-10">
                  No agents found
                </TableCell>
              </TableRow>
            ) : (
              data?.agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm text-surface-950 dark:text-white">
                        {agent.fullName}
                      </span>
                      {agent.licenseNumber && (
                        <span className="text-xs text-surface-400">
                          Lic: {agent.licenseNumber}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <CopyButton text={agent.email} />
                  </TableCell>
                  <TableCell>
                    <CopyButton text={agent.phone} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-surface-600 dark:text-surface-300">
                      {agent.state ? (
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {agent.state}
                        </Badge>
                      ) : (
                        <span className="text-surface-300">—</span>
                      )}
                      <span className="text-surface-400 text-xs">
                        {agent.city || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-surface-600 dark:text-surface-300 max-w-[180px] truncate">
                    {agent.brokerageName || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={agent.isDeliverable ? "success" : "destructive"}
                      className="text-[11px]"
                    >
                      {agent.isDeliverable ? "Deliverable" : "Undeliverable"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(agent)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Agent
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 dark:text-red-400"
                          onClick={() => {
                            setDeleteAgent(agent);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Agent
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-surface-400">
            Showing {(data.pagination.page - 1) * data.pagination.limit + 1}–
            {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{" "}
            {data.pagination.total} agents
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>
              Update agent details for {editingAgent?.fullName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Full Name
              </label>
              <Input
                value={String(editForm.fullName ?? "")}
                onChange={handleEditFieldChange("fullName")}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Email
              </label>
              <Input
                value={String(editForm.email ?? "")}
                onChange={handleEditFieldChange("email")}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Phone
              </label>
              <Input
                value={String(editForm.phone ?? "")}
                onChange={handleEditFieldChange("phone")}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Brokerage
              </label>
              <Input
                value={String(editForm.brokerageName ?? "")}
                onChange={handleEditFieldChange("brokerageName")}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                License Number
              </label>
              <Input
                value={String(editForm.licenseNumber ?? "")}
                onChange={handleEditFieldChange("licenseNumber")}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                State
              </label>
              <Select
                value={String(editForm.state ?? "")}
                onValueChange={(v) =>
                  setEditForm((prev) => ({ ...prev, state: v === "NONE" ? "" : v }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                City
              </label>
              <Input
                value={String(editForm.city ?? "")}
                onChange={handleEditFieldChange("city")}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-surface-200 dark:border-surface-800 p-4">
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  SMTP Deliverability Status
                </p>
                <p className="text-xs text-surface-400">
                  Mark this agent email as deliverable or undeliverable
                </p>
              </div>
              <Switch
                checked={Boolean(editForm.isDeliverable)}
                onCheckedChange={handleEditSwitchChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteAgent?.fullName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteAgent) {
                  deleteMutation.mutate(deleteAgent.id);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk CSV Import</DialogTitle>
            <DialogDescription>
              Upload a CSV file with agent records. The system will upsert by email or Google Place ID.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <CsvColumnHint />
            <div
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-surface-300 dark:border-surface-700 p-8 transition-colors hover:border-primary-400 dark:hover:border-primary-600 cursor-pointer"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="h-10 w-10 text-surface-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  {importFile ? importFile.name : "Drop CSV file here or click to browse"}
                </p>
                <p className="text-xs text-surface-400 mt-1">
                  Supports .csv files
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {importPreview.length > 0 && (
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Preview (first {importPreview.length} of{" "}
                  {importFile ? "all" : ""} rows)
                </p>
                <div className="max-h-40 overflow-auto rounded-md border border-surface-200 dark:border-surface-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(importPreview[0]).slice(0, 5).map((key) => (
                          <TableHead key={key} className="text-xs">
                            {key}
                          </TableHead>
                        ))}
                        {Object.keys(importPreview[0]).length > 5 && (
                          <TableHead className="text-xs">...</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.map((row, idx) => (
                        <TableRow key={idx}>
                          {Object.keys(row)
                            .slice(0, 5)
                            .map((key) => (
                              <TableCell key={key} className="text-xs truncate max-w-[120px]">
                                {row[key] || "—"}
                              </TableCell>
                            ))}
                          {Object.keys(row).length > 5 && (
                            <TableCell className="text-xs text-surface-400">
                              +{Object.keys(row).length - 5} more
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportOpen(false);
                setImportFile(null);
                setImportPreview([]);
              }}
              disabled={importMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleStartImport} disabled={!importFile || importMutation.isPending}>
              {importMutation.isPending ? "Importing..." : "Import Agents"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}