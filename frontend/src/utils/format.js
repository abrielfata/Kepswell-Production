// Formatting helpers shared across pages/components
export const formatCurrency = (amount) => {
    // Terima number atau string numeric
    const num = typeof amount === 'number'
        ? amount
        : Number(String(amount).replace(/,/g, ''));

    if (!Number.isFinite(num)) return 'Rp 0';

    if (num >= 1000000) {
        return 'Rp ' + (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return 'Rp ' + (num / 1000).toFixed(0) + 'K';
    }
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(num);
};

export const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const formatHours = (hours) => {
    if (!hours && hours !== 0) return '0 jam';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m} menit`;
    if (m === 0) return `${h} jam`;
    return `${h} jam ${m} menit`;
};

