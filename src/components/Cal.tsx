"use client";

import { getCalApi } from "@calcom/embed-react";
import { useEffect, ReactNode } from "react";
import { Button, ButtonProps } from "./ui/button";

export function CalProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        (async function () {
            const cal = await getCalApi({ namespace: "30min" });
            cal("ui", {
                "styles": { "branding": { "brandColor": "#000000" } },
                "hideEventTypeDetails": false,
                "layout": "month_view",
                "theme": "light"
            });
        })();
    }, []);

    return <>{children}</>;
}

interface CalButtonProps extends ButtonProps {
    calLink: string;
    config?: any;
}

export function CalButton({ calLink, config, ...props }: CalButtonProps) {
    return (
        <Button
            data-cal-namespace="30min"
            data-cal-link={calLink}
            data-cal-config={config ? JSON.stringify({ ...config, theme: "light" }) : JSON.stringify({ theme: "light" })}
            {...props}
        />
    );
}
