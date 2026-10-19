import InstallmentDetail from "@/components/admin/financial/InstallmentDetail";

export const metadata = {
  title: "جزئیات اقساط | پنل مدیریت",
};

export default async function AdminInstallmentDetailPage({ params }) {
  const { id } = await params;
  return <InstallmentDetail id={id} />;
}
