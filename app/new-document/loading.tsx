import { Box, Skeleton } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="rounded" width={260} height={32} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" width={160} height={20} />
      </Box>
      {Array.from({ length: 4 }).map((_, section) => (
        <Box key={section} sx={{ mb: 4, border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ px: 2.5, py: 1.75, bgcolor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            <Skeleton variant="rounded" width={140} height={22} />
          </Box>
          <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
            {Array.from({ length: 3 }).map((_, field) => (
              <Box key={field}>
                <Skeleton variant="rounded" width={110} height={16} sx={{ mb: 0.75 }} />
                <Skeleton variant="rounded" width="100%" height={48} />
              </Box>
            ))}
          </Box>
        </Box>
      ))}
      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
        <Skeleton variant="rounded" width={120} height={42} />
        <Skeleton variant="rounded" width={160} height={42} />
      </Box>
    </Box>
  );
}
