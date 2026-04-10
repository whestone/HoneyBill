import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Product, TaxRate, PaginatedResponse } from "@honeybill/shared";

export function useProducts(params?: Record<string, string>) {
  const qs = new URLSearchParams(params ?? {}).toString();
  return useQuery<PaginatedResponse<Product>>({
    queryKey: ["products", params],
    queryFn: () => api.get(`/products${qs ? `?${qs}` : ""}`),
  });
}

export function useProduct(id: number) {
  return useQuery<Product>({
    queryKey: ["products", id],
    queryFn: () => api.get(`/products/${id}`),
    enabled: id > 0,
  });
}

export function useTaxRates() {
  return useQuery<TaxRate[]>({
    queryKey: ["tax-rates"],
    queryFn: () => api.get("/tax-rates"),
    staleTime: 5 * 60_000,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.post<Product>("/products", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.put<Product>(`/products/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products", id] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}
