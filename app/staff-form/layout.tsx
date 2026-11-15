import { Metadata } from "next";

export const metadata: Metadata = {
  title: "360 Degree - Staff Portal & Profile Update",
  description:
    "Official Staff Digital Profile & Document Submission Portal - Office of the General Manager",
  openGraph: {
    title: "360 Degree - Staff Portal & Profile Update",
    description:
      "Official Staff Digital Profile & Document Submission Portal - Office of the General Manager",
    siteName: "360 Degree Global Estate Ltd.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "360 Degree - Staff Portal & Profile Update",
    description: "Official Staff Digital Profile & Document Submission Portal",
  },
};

export default function StaffFormLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
