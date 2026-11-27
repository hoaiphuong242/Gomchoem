import { useEffect, useState } from "react";
import { get } from "@/services/api/client";

export function useRemote(path, version = 0) {
  const [result, setResult] = useState({ path: null, data: null, error: null });
  useEffect(() => {
    if (!path) return;
    let active = true;
    const load = () =>
      get(path)
        .then((data) => {
          if (active) setResult({ path, data, error: null });
        })
        .catch((error) => {
          if (active) setResult({ path, data: null, error });
        });
    load();
    window.addEventListener("gce-refresh", load);
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("gce-refresh", load);
    };
  }, [path, version]);
  return result.path === path ? result : { data: null, error: null };
}
