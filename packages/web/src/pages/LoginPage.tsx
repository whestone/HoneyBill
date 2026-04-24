import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@/api/hooks/useAuth";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth.store";
import { useEffect } from "react";
import { Label } from "@/components/ui/Label";

const schema = z.object({
  email: z.string().min(1, "Benutzername erforderlich"),
  password: z.string().min(1, "Passwort erforderlich"),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (token) navigate({ to: "/" });
  }, [token, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = (data: FormData) => {
    login.mutate(data, { onSuccess: () => navigate({ to: "/" }) });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-honey-50 to-honey-100">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍯</div>
          <h1 className="text-2xl font-bold text-gray-900">HoneyBill</h1>
          <p className="text-gray-500 text-sm mt-1">Abrechnungssoftware</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label required>Benutzername</Label>
              <input
                {...register("email")}
                type="text"
                autoComplete="username"
                autoFocus
                className="input"
                placeholder="admin"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>
            <div>
              <Label required>Passwort</Label>
              <input
                {...register("password")}
                type="password"
                autoComplete="current-password"
                className="input"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>
            {login.error && (
              <p className="text-red-500 text-sm">{(login.error as Error).message}</p>
            )}
            <button
              type="submit"
              disabled={login.isPending}
              className="btn-primary w-full justify-center"
            >
              {login.isPending ? "Anmelden…" : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
