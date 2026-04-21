import { Box, Skeleton } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Skeleton variant="rounded" width={200} height={36} />
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Skeleton variant="rounded" width={120} height={40} />
          <Skeleton variant="rounded" width={130} height={40} />
        </Box>
      </Box>
      <Box sx={{ display: "flex", gap: 2.5 }}>
        {/* Category sidebar */}
        <Box sx={{ width: 220, flexShrink: 0, border: "1px solid #E5E7EB", borderRadius: 2, p: 1.5 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={36} sx={{ mb: 0.75, borderRadius: 1 }} />
          ))}
        </Box>
        {/* Table */}
        <Box sx={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ p: 2, borderBottom: "1px solid #E5E7EB" }}>
            <Skeleton variant="rounded" width="100%" height={40} />
          </Box>
          {Array.from({ length: 8 }).map((_, i) => (
            <Box key={i} sx={{ px: 2, py: 1.5, borderBottom: "1px solid #F3F4F6", display: "flex", gap: 2, alignItems: "center" }}>
              <Skeleton variant="rounded" width={160} height={18} />
              <Skeleton variant="rounded" width={240} height={18} />
              <Skeleton variant="rounded" width={100} height={22} sx={{ borderRadius: 10, ml: "auto" }} />
              <Skeleton variant="circular" width={28} height={28} />
              <Skeleton variant="circular" width={28} height={28} />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
