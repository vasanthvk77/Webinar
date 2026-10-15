import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    Stack,
    Popper,
    ClickAwayListener,
    TextField,
    InputAdornment,
    Button,
    useTheme
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const CustomTimePicker = ({ value, onChange, label, starStyle, inputStyle, disabled }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [anchorEl, setAnchorEl] = useState(null);

    // internal states for the clock UI
    const [activeMode, setActiveMode] = useState('hours'); // 'hours' | 'minutes'
    const [selectedHour, setSelectedHour] = useState(9); // 1 to 12
    const [selectedMinute, setSelectedMinute] = useState(0); // 0 to 59
    const [ampm, setAmpm] = useState('AM'); // 'AM' | 'PM'

    // Initialize from parent value "HH:mm"
    useEffect(() => {
        if (value) {
            const [hStr, mStr] = value.split(':');
            const h = parseInt(hStr, 10) || 0;
            const m = parseInt(mStr, 10) || 0;
            setSelectedMinute(m);

            if (h === 0) {
                setSelectedHour(12);
                setAmpm('AM');
            } else if (h === 12) {
                setSelectedHour(12);
                setAmpm('PM');
            } else if (h > 12) {
                setSelectedHour(h - 12);
                setAmpm('PM');
            } else {
                setSelectedHour(h);
                setAmpm('AM');
            }
        }
    }, [value]);

    const handleClick = (event) => {
        if (disabled) return;
        setAnchorEl(anchorEl ? null : event.currentTarget);
        setActiveMode('hours');
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const id = open ? 'time-picker-popper' : undefined;

    // Convert "HH:mm" or "HH:mm:ss" → "hh:mm AM/PM" for display
    const format12hDisplay = (val) => {
        if (!val) return '';
        const parts = val.split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
    };

    // Convert 12h representation back to 24h string "HH:mm"
    const get24TimeString = (h12, min, amPmVal) => {
        let h = h12;
        if (amPmVal === 'PM' && h < 12) h += 12;
        if (amPmVal === 'AM' && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    const handleConfirm = () => {
        const timeStr = get24TimeString(selectedHour, selectedMinute, ampm);
        onChange({ target: { value: timeStr } });
        handleClose();
    };

    // Calculate angles for clock numbers layout
    const getNumberCoords = (index, total = 12, radius = 66, center = 90) => {
        const angle = (index * (360 / total) - 90) * (Math.PI / 180);
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        return { x, y };
    };

    // Hours on the face: 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
    const hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    // Minutes on the face (multiples of 5): 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
    const minuteNumbers = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    // Clock hand angle calculation
    const getHandAngle = () => {
        if (activeMode === 'hours') {
            return (selectedHour % 12) * 30; // 30 deg per hour
        } else {
            return selectedMinute * 6; // 6 deg per minute
        }
    };

    return (
        <Box sx={{ width: '100%' }}>
            {label && (
                <Typography sx={{ fontSize: '12px', mb: 1, color: 'text.secondary', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                    {label} {starStyle && <span style={starStyle}>*</span>}
                </Typography>
            )}
            <TextField
                fullWidth
                size="small"
                disabled={disabled}
                onClick={handleClick}
                value={format12hDisplay(value)}
                autoComplete="off"
                placeholder="hh:mm AM/PM"
                slotProps={{
                    input: {
                        readOnly: true,
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton size="small" disabled={disabled} sx={{ p: 0 }}>
                                    <AccessTimeIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                                </IconButton>
                            </InputAdornment>
                        ),
                    },
                }}
                sx={{
                    ...inputStyle,
                    '& .MuiInputBase-input': { cursor: 'pointer', fontSize: '14px', py: '10px' }
                }}
            />

            <Popper id={id} open={open} anchorEl={anchorEl} placement="bottom-start" sx={{ zIndex: 1300, mt: 1 }}>
                <ClickAwayListener onClickAway={handleClose}>
                    <Paper
                        elevation={12}
                        sx={{
                            p: 2,
                            width: 250,
                            bgcolor: 'background.paper',
                            color: 'text.primary',
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: '12px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}
                    >
                        {/* Selected Time Header */}
                        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ mb: 2, width: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'action.hover', borderRadius: '8px', p: '4px 12px' }}>
                                <Typography
                                    onClick={() => setActiveMode('hours')}
                                    sx={{
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        color: activeMode === 'hours' ? 'primary.main' : 'text.secondary',
                                        transition: 'color 0.15s',
                                        '&:hover': { color: 'primary.light' }
                                    }}
                                >
                                    {String(selectedHour).padStart(2, '0')}
                                </Typography>
                                <Typography sx={{ fontSize: '28px', fontWeight: 700, color: 'text.secondary', mx: 0.5 }}>:</Typography>
                                <Typography
                                    onClick={() => setActiveMode('minutes')}
                                    sx={{
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        color: activeMode === 'minutes' ? 'primary.main' : 'text.secondary',
                                        transition: 'color 0.15s',
                                        '&:hover': { color: 'primary.light' }
                                    }}
                                >
                                    {String(selectedMinute).padStart(2, '0')}
                                </Typography>
                            </Box>

                            {/* AM / PM Toggle */}
                            <Stack spacing={0.5}>
                                <Button
                                    variant={ampm === 'AM' ? 'contained' : 'outlined'}
                                    size="small"
                                    onClick={() => setAmpm('AM')}
                                    sx={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        p: '2px 8px',
                                        minWidth: 42,
                                        height: 22,
                                        textTransform: 'none'
                                    }}
                                >
                                    AM
                                </Button>
                                <Button
                                    variant={ampm === 'PM' ? 'contained' : 'outlined'}
                                    size="small"
                                    onClick={() => setAmpm('PM')}
                                    sx={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        p: '2px 8px',
                                        minWidth: 42,
                                        height: 22,
                                        textTransform: 'none'
                                    }}
                                >
                                    PM
                                </Button>
                            </Stack>
                        </Stack>

                        {/* Circular Clock Face */}
                        <Box
                            sx={{
                                width: 180,
                                height: 180,
                                borderRadius: '50%',
                                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                border: `1px solid ${theme.palette.divider}`,
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mb: 2
                            }}
                        >
                            {/* Center Dot */}
                            <Box
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: 'primary.main',
                                    position: 'absolute',
                                    zIndex: 3
                                }}
                            />

                            {/* Clock Hand line */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    bottom: '50%',
                                    left: 'calc(50% - 1.5px)',
                                    width: '3px',
                                    height: '66px',
                                    transformOrigin: 'bottom center',
                                    transform: `rotate(${getHandAngle()}deg)`,
                                    bgcolor: 'primary.main',
                                    zIndex: 2,
                                    borderTopLeftRadius: '2px',
                                    borderTopRightRadius: '2px',
                                    transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                            />

                            {/* Render Numbers */}
                            {activeMode === 'hours' ? (
                                hourNumbers.map((num, idx) => {
                                    const { x, y } = getNumberCoords(idx);
                                    const isSelected = selectedHour === num;
                                    return (
                                        <Box
                                            key={num}
                                            onClick={() => {
                                                setSelectedHour(num);
                                                // auto transition to minutes selection
                                                setTimeout(() => setActiveMode('minutes'), 200);
                                            }}
                                            sx={{
                                                position: 'absolute',
                                                left: x - 13,
                                                top: y - 13,
                                                width: 26,
                                                height: 26,
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '13px',
                                                fontWeight: isSelected ? 700 : 500,
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                zIndex: 4,
                                                color: isSelected ? '#ffffff' : 'text.primary',
                                                bgcolor: isSelected ? 'primary.main' : 'transparent',
                                                boxShadow: isSelected ? '0 2px 8px rgba(59,130,246,0.4)' : 'none',
                                                '&:hover': {
                                                    bgcolor: isSelected ? 'primary.main' : 'action.hover'
                                                },
                                                transition: 'all 0.1s'
                                            }}
                                        >
                                            {num}
                                        </Box>
                                    );
                                })
                            ) : (
                                minuteNumbers.map((num, idx) => {
                                    const { x, y } = getNumberCoords(idx);
                                    // Highlight if it's the exact minute or closest 5 min preset
                                    const isSelected = selectedMinute === num || (selectedMinute % 5 !== 0 && Math.round(selectedMinute / 5) * 5 % 60 === num);
                                    return (
                                        <Box
                                            key={num}
                                            onClick={() => {
                                                setSelectedMinute(num);
                                            }}
                                            sx={{
                                                position: 'absolute',
                                                left: x - 13,
                                                top: y - 13,
                                                width: 26,
                                                height: 26,
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '12px',
                                                fontWeight: isSelected ? 700 : 500,
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                zIndex: 4,
                                                color: isSelected ? '#ffffff' : 'text.secondary',
                                                bgcolor: isSelected ? 'primary.main' : 'transparent',
                                                boxShadow: isSelected ? '0 2px 8px rgba(59,130,246,0.4)' : 'none',
                                                '&:hover': {
                                                    bgcolor: isSelected ? 'primary.main' : 'action.hover'
                                                },
                                                transition: 'all 0.1s'
                                            }}
                                        >
                                            {String(num).padStart(2, '0')}
                                        </Box>
                                    );
                                })
                            )}
                        </Box>

                        {/* Helper info / Minute fine adjustment */}
                        {activeMode === 'minutes' && (
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Fine Tune:</Typography>
                                <Button
                                    size="small"
                                    onClick={() => setSelectedMinute(prev => (prev - 1 + 60) % 60)}
                                    sx={{ minWidth: 24, height: 20, p: 0 }}
                                >
                                    -1m
                                </Button>
                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{selectedMinute}m</Typography>
                                <Button
                                    size="small"
                                    onClick={() => setSelectedMinute(prev => (prev + 1) % 60)}
                                    sx={{ minWidth: 24, height: 20, p: 0 }}
                                >
                                    +1m
                                </Button>
                            </Stack>
                        )}

                        {/* Action Buttons */}
                        <Box sx={{ width: '100%', pt: 1.5, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between' }}>
                            <Button
                                size="small"
                                onClick={() => { onChange({ target: { value: '' } }); handleClose(); }}
                                sx={{ color: 'error.main', textTransform: 'none', fontWeight: 700, fontSize: '13px' }}
                            >
                                Clear
                            </Button>
                            <Stack direction="row" spacing={1}>
                                <Button
                                    size="small"
                                    onClick={handleClose}
                                    sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600, fontSize: '13px' }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleConfirm}
                                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '13px', px: 2 }}
                                >
                                    OK
                                </Button>
                            </Stack>
                        </Box>
                    </Paper>
                </ClickAwayListener>
            </Popper>
        </Box>
    );
};

export default CustomTimePicker;
