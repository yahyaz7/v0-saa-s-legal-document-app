import { Box, Skeleton } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="rounded" width={180} height={36} sx={{ mb: 3 }} />
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Box key={i} sx={{ px: 2, py: 1.75, borderBottom: "1px solid #F3F4F6", display: "flex", gap: 2, alignItems: "center" }}>
            <Skeleton variant="rounded" width={220} height={20} />
            <Skeleton variant="rounded" width={110} height={20} />
            <Skeleton variant="rounded" width={90} height={20} />
            <Box sx={{ ml: "auto" }}>
              <Skeleton variant="rounded" width={80} height={30} sx={{ borderRadius: 1 }} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
