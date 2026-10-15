import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  ButtonBase,
  Chip,
  Fade,
  Popper,
  ClickAwayListener,
  TextField,
  InputAdornment,
  useTheme,
} from '@mui/material';

// ── Inline SVG icons (no extra deps) ─────────────────────
const ChevronLeftIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ChevronRightIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const ArrowDropDownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);
const CloseSmIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);
const TodayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><circle cx="12" cy="15" r="2" />
  </svg>
);
const ClearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
  </svg>
);

// ── Constants ─────────────────────────────────────────────
const DAYS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

// ── Helpers ───────────────────────────────────────────────
const isSameDay = (d1, d2) =>
  d1 && d2 &&
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth()    === d2.getMonth()    &&
  d1.getDate()     === d2.getDate();

const getDaysInMonth  = (y, m) => new Date(y, m + 1, 0).getDate();
const getFirstWeekDay = (y, m) => new Date(y, m, 1).getDay();

// "yyyy-MM-dd" ↔ Date
const strToDate = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const dateToStr = (dt) => {
  if (!dt) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
};
const displayStr = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}-${m}-${y}`;
};

// ── Component ─────────────────────────────────────────────
const CustomDatePicker = ({ value, onChange, label, starStyle, inputStyle, disabled }) => {
  const theme  = useTheme();
  const today  = new Date();

  const selectedDate = strToDate(value);
  const [anchorEl,        setAnchorEl]        = useState(null);
  const [viewDate,        setViewDate]        = useState(selectedDate || today);
  const [overlayOpen,     setOverlayOpen]     = useState(false);
  const [pickerViewMode,  setPickerViewMode]  = useState('months');
  const [yearRangeStart,  setYearRangeStart]  = useState(Math.floor((selectedDate || today).getFullYear() / 12) * 12);

  // Keep view synced when value changes externally (edit mode)
  useEffect(() => {
    if (value) {
      const d = strToDate(value);
      setViewDate(d);
      setYearRangeStart(Math.floor(d.getFullYear() / 12) * 12);
    }
  }, [value]);

  const open = Boolean(anchorEl);
  const handleOpen  = (e) => { if (!disabled) { setAnchorEl(e.currentTarget); setOverlayOpen(false); } };
  const handleClose = ()  => { setAnchorEl(null); setOverlayOpen(false); };

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const selectDay = (dayNum) => {
    const picked = new Date(year, month, dayNum);
    onChange({ target: { value: dateToStr(picked) } });
    handleClose();
  };

  const clearDate = () => { onChange({ target: { value: '' } }); handleClose(); };

  const goToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    onChange({ target: { value: dateToStr(today) } });
    handleClose();
  };

  // Grid data
  const daysInMonth = getDaysInMonth(year, month);
  const firstDOW    = getFirstWeekDay(year, month);
  const yearGrid    = Array.from({ length: 12 }, (_, i) => yearRangeStart + i);

  return (
    <Box sx={{ width: '100%' }}>
      {label && (
        <Typography sx={{ fontSize: '12px', mb: 1, color: 'text.secondary', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
          {label}{starStyle && <span style={starStyle}>*</span>}
        </Typography>
      )}

      {/* ── Trigger input ── */}
      <TextField
        fullWidth
        size="small"
        disabled={disabled}
        onClick={handleOpen}
        value={displayStr(value)}
        autoComplete="off"
        placeholder="dd-mm-yyyy"
        slotProps={{
          input: {
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" disabled={disabled} sx={{ p: 0, color: theme.palette.text.secondary }}>
                  <CalendarIcon />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        sx={{
          ...inputStyle,
          '& .MuiInputBase-input': { cursor: 'pointer', fontSize: '14px', py: '10px' },
        }}
      />

      {/* ── Popper calendar ── */}
      <Popper open={open} anchorEl={anchorEl} placement="bottom-start" sx={{ zIndex: 1400, mt: 1 }}>
        <ClickAwayListener onClickAway={handleClose}>
          {/* DatePickerCRM style panel */}
          <Paper
            elevation={24}
            sx={{
              width: 300,
              bgcolor: '#0A0F1D',
              color: '#F8FAFC',
              borderRadius: '24px',
              p: 2.5,
              border: '1px solid rgba(51,65,85,0.6)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
              position: 'relative',
              userSelect: 'none',
            }}
          >
            {/* Month / Year header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
              <Button
                onClick={() => { setOverlayOpen(v => !v); setPickerViewMode('months'); setYearRangeStart(Math.floor(year / 12) * 12); }}
                endIcon={<ArrowDropDownIcon />}
                sx={{
                  color: '#FFFFFF', fontWeight: 700, fontSize: '1rem',
                  textTransform: 'none', px: 1, py: 0.5, borderRadius: 2,
                  '&:hover': { bgcolor: 'rgba(91,80,246,0.15)', color: '#7C87F7' },
                }}
              >
                {MONTHS[month]} {year}
              </Button>

              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton onClick={prevMonth} size="small" sx={{ color: '#94A3B8', '&:hover': { color: '#FFF', bgcolor: 'rgba(255,255,255,0.08)' } }}>
                  <ChevronLeftIcon />
                </IconButton>
                <IconButton onClick={nextMonth} size="small" sx={{ color: '#94A3B8', '&:hover': { color: '#FFF', bgcolor: 'rgba(255,255,255,0.08)' } }}>
                  <ChevronRightIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Month / Year overlay */}
            {overlayOpen && (
              <Fade in={overlayOpen}>
                <Paper sx={{
                  position: 'absolute', left: 12, right: 12, top: 60, zIndex: 30,
                  bgcolor: '#0E1628', border: '1px solid rgba(71,85,105,0.7)',
                  borderRadius: '16px', p: 2, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.8)',
                }}>
                  {/* Months / Years tabs */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, pb: 1, borderBottom: '1px solid rgba(51,65,85,0.6)' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {['months','years'].map(mode => (
                        <Button key={mode} size="small" onClick={() => setPickerViewMode(mode)}
                          sx={{
                            borderRadius: 2, fontSize: '0.75rem', fontWeight: 600,
                            textTransform: 'none', py: 0.5, px: 1.5,
                            bgcolor: pickerViewMode === mode ? '#5B50F6' : 'transparent',
                            color:   pickerViewMode === mode ? '#FFF' : '#94A3B8',
                            '&:hover': { bgcolor: pickerViewMode === mode ? '#3843D0' : 'rgba(255,255,255,0.08)' },
                          }}>
                          {mode === 'months' ? 'Months' : `Years (${yearRangeStart}–${yearRangeStart+11})`}
                        </Button>
                      ))}
                    </Box>
                    <IconButton size="small" onClick={() => setOverlayOpen(false)} sx={{ color: '#94A3B8', '&:hover': { color: '#FFF' } }}>
                      <CloseSmIcon />
                    </IconButton>
                  </Box>

                  {pickerViewMode === 'months' ? (
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1 }}>
                      {MONTHS.map((mn, idx) => (
                        <Button key={mn} onClick={() => { setViewDate(new Date(year, idx, 1)); setOverlayOpen(false); }}
                          sx={{
                            py: 1, fontSize: '0.75rem', fontWeight: 600, borderRadius: '12px', textTransform: 'none',
                            bgcolor: idx === month ? '#5B50F6' : 'transparent',
                            color:   idx === month ? '#FFF' : '#CBD5E1',
                            '&:hover': { bgcolor: idx === month ? '#3843D0' : 'rgba(255,255,255,0.08)' },
                          }}>
                          {mn.slice(0,3)}
                        </Button>
                      ))}
                    </Box>
                  ) : (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Button size="small" onClick={() => setYearRangeStart(y => y - 12)} sx={{ color: '#94A3B8', fontSize: '0.7rem', textTransform: 'none' }}>‹ Prev 12</Button>
                        <Button size="small" onClick={() => setYearRangeStart(y => y + 12)} sx={{ color: '#94A3B8', fontSize: '0.7rem', textTransform: 'none' }}>Next 12 ›</Button>
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1 }}>
                        {yearGrid.map(y => (
                          <Button key={y} onClick={() => { setViewDate(new Date(y, month, 1)); setPickerViewMode('months'); }}
                            sx={{
                              py: 1, fontSize: '0.75rem', fontWeight: 600, borderRadius: '12px', textTransform: 'none',
                              bgcolor: y === year ? '#5B50F6' : 'transparent',
                              color:   y === year ? '#FFF' : '#CBD5E1',
                              '&:hover': { bgcolor: y === year ? '#3843D0' : 'rgba(255,255,255,0.08)' },
                            }}>
                            {y}
                          </Button>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Paper>
              </Fade>
            )}

            {/* Weekday headers */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', textAlign: 'center', mb: 1 }}>
              {DAYS.map(d => (
                <Typography key={d} sx={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#94A3B8', fontSize: '0.75rem' }}>
                  {d}
                </Typography>
              ))}
            </Box>

            {/* Day cells */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: 0.5, columnGap: 0.25, textAlign: 'center' }}>
              {Array.from({ length: firstDOW }).map((_, i) => <Box key={`e${i}`} sx={{ height: 36 }} />)}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(dayNum => {
                const cellDate  = new Date(year, month, dayNum);
                const isSelected = isSameDay(cellDate, selectedDate);
                const isToday    = isSameDay(cellDate, today);

                return (
                  <Box key={dayNum} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ButtonBase
                      onClick={() => selectDay(dayNum)}
                      sx={{
                        height: 36, width: 36, borderRadius: '12px',
                        fontSize: '0.875rem',
                        fontWeight: isSelected ? 700 : isToday ? 600 : 500,
                        transition: 'all 0.15s ease-in-out',
                        ...(isSelected ? {
                          bgcolor: '#5B50F6',
                          color: '#FFF',
                          boxShadow: '0 8px 16px -2px rgba(91,80,246,0.4)',
                          transform: 'scale(1.06)',
                        } : isToday ? {
                          border: '2px solid #3843D0',
                          color: '#7C87F7',
                          bgcolor: 'rgba(56,67,208,0.12)',
                        } : {
                          color: '#E2E8F0',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: '#FFF' },
                        }),
                      }}
                    >
                      {dayNum}
                    </ButtonBase>
                  </Box>
                );
              })}
            </Box>

            {/* Footer */}
            <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(51,65,85,0.6)', display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={clearDate} startIcon={<ClearIcon />}
                sx={{ color: '#F43F5E', fontSize: '0.75rem', fontWeight: 600, textTransform: 'none', borderRadius: '8px', '&:hover': { bgcolor: 'rgba(244,63,94,0.1)' } }}>
                Clear
              </Button>
              <Button onClick={goToday} startIcon={<TodayIcon />}
                sx={{ color: '#7C87F7', fontSize: '0.75rem', fontWeight: 600, textTransform: 'none', borderRadius: '8px', '&:hover': { bgcolor: 'rgba(124,135,247,0.1)' } }}>
                Today
              </Button>
            </Box>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
};

export default CustomDatePicker;
