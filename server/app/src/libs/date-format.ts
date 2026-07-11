export class DateFormat {
    
    /**
     * Returns current date as "YYYY-MM-DD"
     * e.g. "2026-07-11"
     */
    static toDateString(date: Date = new Date()): string {
        const yyyy = date.getFullYear();
        const mm   = String(date.getMonth() + 1).padStart(2, '0');
        const dd   = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    /**
     * Returns current datetime as "YYYY-MM-DD HH:mm:ss"
     * e.g. "2026-07-11 15:08:00"
     */
    static toDateTimeString(date: Date = new Date()): string {
        const datePart = DateFormat.toDateString(date);
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const ss  = String(date.getSeconds()).padStart(2, '0');
        return `${datePart} ${hh}:${min}:${ss}`;
    }

    /**
     * Returns Unix timestamp as string
     * e.g. "1752242880"
     */
    static toTimestamp(date: Date = new Date()): string {
        return String(Math.floor(date.getTime() / 1000));
    }
}
