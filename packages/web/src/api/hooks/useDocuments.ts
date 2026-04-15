import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type {
  CreateDocumentInput,
  Document,
  PaginatedResponse,
  CreatePaymentInput,
} from "@honeybill/shared";

export function useDocuments(params?: Record<string, string>) {
  const qs = new URLSearchParams(params ?? {}).toString();
  return useQuery<PaginatedResponse<Document>>({
    queryKey: ["documents", params],
    queryFn: () => api.get(`/documents${qs ? `?${qs}` : ""}`),
  });
}

export function useDocument(id: number) {
  return useQuery<Document>({
    queryKey: ["documents", id],
    queryFn: () => api.get(`/documents/${id}`),
    enabled: id > 0,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDocumentInput) => api.post<Document>("/documents", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useUpdateDocument(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateDocumentInput>) =>
      api.put<Document>(`/documents/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["documents", id] });
    },
  });
}

export function useFinalizeDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Document>(`/documents/${id}/finalize`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useSendDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/documents/${id}/send`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useCancelDocument() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean; stornoId: number }, Error, number>({
    mutationFn: (id: number) => api.post(`/documents/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useAddPayment(docId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePaymentInput) =>
      api.post(`/documents/${docId}/payments`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", docId] }),
  });
}

export function useConvertToInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Document>(`/documents/${id}/convert-to-invoice`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Document>(`/documents/${id}/create-credit-note`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useRelatedDocuments(id: number) {
  return useQuery<Document[]>({
    queryKey: ["documents", id, "related"],
    queryFn: () => api.get(`/documents/${id}/related`),
    enabled: id > 0,
  });
}

export function useCreateDeliveryNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Document>(`/documents/${id}/create-delivery-note`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}
