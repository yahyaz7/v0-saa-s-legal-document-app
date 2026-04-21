import { Box, Skeleton } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Skeleton variant="rounded" width={180} height={36} />
        <Skeleton variant="rounded" width={120} height={40} />
      </Box>
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid #E5E7EB", bgcolor: "#F9FAFB", display: "flex", gap: 2 }}>
          {[160, 120, 100, 90].map((w, i) => (
            <Skeleton key={i} variant="rounded" width={w} height={20} />
          ))}
        </Box>
        {Array.from({ length: 6 }).map((_, i) => (
          <Box key={i} sx={{ px: 2, py: 1.75, borderBottom: "1px solid #F3F4F6", display: "flex", gap: 2, alignItems: "center" }}>
            <Skeleton variant="rounded" width={220} height={20} />
            <Skeleton variant="rounded" width={110} height={20} />
            <Skeleton variant="rounded" width={90} height={20} />
            <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
              <Skeleton variant="rounded" width={80} height={30} sx={{ borderRadius: 1 }} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
