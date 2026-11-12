import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  IconButton,
  Button
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useThemeColors } from '../context/ThemeContext';

/**
 * CustomPagination
 * 
 * Reusable, responsive table pagination component.
 * 
 * Props:
 *   totalItems         — total count of all records (number)
 *   page               — 1-based current page index (number, default: 1)
 *   pageSize           — current rows per page (number, default: 10)
 *   onPageChange       — (newPage: number) => void
 *   onPageSizeChange   — (newPageSize: number) => void
 *   pageSizeOptions    — array of numbers (default: [10, 20, 30, 50, 100])
 *   sx                 — optional MUI sx container styles
 */
export default function CustomPagination({
  totalItems = 0,
  page = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 50, 100],
  sx = {}
}) {
  const colors = useThemeColors();

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const startRecord = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endRecord = Math.min(safePage * pageSize, totalItems);

  // Generate page numbers with intelligent ellipsis
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (safePage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (safePage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  }, [totalPages, safePage]);

  const handlePrev = () => {
    if (safePage > 1 && onPageChange) {
      onPageChange(safePage - 1);
    }
  };

  const handleNext = () => {
    if (safePage < totalPages && onPageChange) {
      onPageChange(safePage + 1);
    }
  };

  const handlePageClick = (p) => {
    if (p !== '...' && p !== safePage && onPageChange) {
      onPageChange(p);
    }
  };

  const handlePageSizeSelect = (e) => {
    const newSize = Number(e.target.value);
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    }
    // Automatically reset to page 1 when page size changes
    if (onPageChange) {
      onPageChange(1);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        px: { xs: 2, sm: 2.5 },
        py: 1.75,
        bgcolor: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        ...sx
      }}
    >
      {/* ── Left: Range Display ── */}
      <Typography
        sx={{
          fontSize: '13px',
          fontWeight: 500,
          color: colors.textMuted,
          userSelect: 'none'
        }}
      >
        {totalItems === 0
          ? 'Showing 0 of 0'
          : `Showing ${startRecord}–${endRecord} of ${totalItems}`}
      </Typography>

      {/* ── Right: Page Size Selector & Navigation ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, sm: 1.5 },
          flexWrap: 'wrap'
        }}
      >
        {/* Page Size Dropdown */}
        <Select
          value={pageSize}
          onChange={handlePageSizeSelect}
          size="small"
          sx={{
            height: 32,
            fontSize: '12.5px',
            fontWeight: 600,
            color: colors.primary,
            bgcolor: colors.surfaceAlt,
            borderRadius: '999px',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.border
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#eab308'
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#eab308'
            },
            '& .MuiSelect-select': {
              py: 0.5,
              pl: 1.5,
              pr: 3.5
            }
          }}
        >
          {pageSizeOptions.map((opt) => (
            <MenuItem key={opt} value={opt} sx={{ fontSize: '13px', fontWeight: 500 }}>
              {opt} per page
            </MenuItem>
          ))}
        </Select>

        {/* Previous Button */}
        <IconButton
          size="small"
          onClick={handlePrev}
          disabled={safePage <= 1}
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            bgcolor: colors.surface,
            color: colors.primary,
            transition: 'all 0.15s ease',
            '&:hover:not(:disabled)': {
              bgcolor: colors.surfaceAlt,
              borderColor: '#eab308'
            },
            '&:disabled': {
              opacity: 0.4,
              borderColor: colors.border
            }
          }}
        >
          <ChevronLeftIcon sx={{ fontSize: 18 }} />
        </IconButton>

        {/* Page Number Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {pageNumbers.map((p, idx) => {
            if (p === '...') {
              return (
                <Box
                  key={`ellipsis-${idx}`}
                  sx={{
                    width: 28,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.textMuted,
                    fontSize: '13px',
                    fontWeight: 600,
                    userSelect: 'none'
                  }}
                >
                  …
                </Box>
              );
            }

            const isActive = p === safePage;
            return (
              <Button
                key={p}
                onClick={() => handlePageClick(p)}
                size="small"
                sx={{
                  minWidth: 32,
                  height: 32,
                  p: 0,
                  fontSize: '12.5px',
                  fontWeight: isActive ? 800 : 500,
                  borderRadius: '8px',
                  color: isActive ? '#1e293b' : colors.primary,
                  bgcolor: isActive ? '#eab308' : 'transparent',
                  border: isActive ? '1px solid #eab308' : `1px solid transparent`,
                  boxShadow: isActive ? '0 2px 8px rgba(234, 179, 8, 0.4)' : 'none',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: isActive ? '#ca8a04' : colors.surfaceAlt,
                    borderColor: isActive ? '#ca8a04' : colors.border
                  }
                }}
              >
                {p}
              </Button>
            );
          })}
        </Box>

        {/* Next Button */}
        <IconButton
          size="small"
          onClick={handleNext}
          disabled={safePage >= totalPages}
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            bgcolor: colors.surface,
            color: colors.primary,
            transition: 'all 0.15s ease',
            '&:hover:not(:disabled)': {
              bgcolor: colors.surfaceAlt,
              borderColor: '#eab308'
            },
            '&:disabled': {
              opacity: 0.4,
              borderColor: colors.border
            }
          }}
        >
          <ChevronRightIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Box>
  );
}

