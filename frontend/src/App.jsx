import { Toaster } from "sonner";
import Router from "@/app/router/Router";
import "./App.css";

export default function App() {
  return (
    <>
      <Router />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
