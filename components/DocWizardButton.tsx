"use client";

import { useState } from "react";
import { Button } from "@mui/material";
import { Wand2 } from "lucide-react";
import DocWizardModal from "./DocWizardModal";
import type { DocWizardResult } from "./DocWizardModal";

interface Props {
  variant?: "contained" | "outlined";
  onConfirm?: (result: DocWizardResult) => void;
}

export default function DocWizardButton({ variant = "outlined", onConfirm }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size="small"
        startIcon={<Wand2 size={15} />}
        onClick={() => setOpen(true)}
        sx={{
          textTransform: "none",
          fontWeight: 600,
          borderColor: "#395B45",
          color: variant === "contained" ? "#fff" : "#395B45",
          bgcolor: variant === "contained" ? "#395B45" : undefined,
          "&:hover": {
            bgcolor: "#2d4a37",
            borderColor: "#2d4a37",
            color: "#fff",
          },
        }}
      >
        Doc Wizard
      </Button>

      <DocWizardModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={(result) => {
          onConfirm?.(result);
          setOpen(false);
        }}
      />
    </>
  );
}
