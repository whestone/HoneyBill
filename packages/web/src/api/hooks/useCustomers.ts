import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Customer, CreateCustomerInput, PaginatedResponse } from "@honeybill/shared";

export function useCustomers(params?: Record<string, string>) {
  const qs = new URLSearchParams(params ?? {}).toString();
  return useQuery<PaginatedResponse<Customer>>({
    queryKey: ["customers", params],
    queryFn: () => api.get(`/customers${qs ? `?${qs}` : ""}`),
  });
}

export function useCustomer(id: number) {
  return useQuery<Customer>({
    queryKey: ["customers", id],
    queryFn: () => api.get(`/customers/${id}`),
    enabled: id > 0,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomerInput) => api.post<Customer>("/customers", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateCustomerInput>) =>
      api.put<Customer>(`/customers/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", id] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}
