import { Metadata } from "next";

export const metadata: Metadata = {
  title: "360 Degree - Staff Portal & Profile Update",
  description:
    "Official Staff Digital Profile & Document Submission Portal - IT Department",
  openGraph: {
    title: "360 Degree - Staff Portal & Profile Update",
    description:
      "Official Staff Digital Profile & Document Submission Portal - IT Department",
    siteName: "360 Degree Global Estate Ltd.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "360 Degree - Staff Portal & Profile Update",
    description: "Official Staff Digital Profile & Document Submission Portal - IT Department",
  },
};

export default function StaffFormLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

