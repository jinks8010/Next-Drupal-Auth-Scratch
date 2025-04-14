
"use client";


import { useRouter } from "next/navigation";
import { logoutUser } from "@/app/utils/auth";


type ReusableButtonProp = {
    label: string; 
    action?: "logout"|"create";
  };

export default function Button({label, action}: ReusableButtonProp) {
   const router = useRouter();

  const handleClick = () => {
    if (action === "logout") {
      logoutUser();
      router.push("/login");
    } else if (action === "create") {
      router.push("/articles/create");
    } else {
      console.warn("No valid action defined for button.");
    }
  };
  return (
    <button
    onClick={handleClick}
      className="absolute top-6 right-6 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
    >
      {label}
    </button>
  );
}
