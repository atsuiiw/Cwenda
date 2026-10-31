// MCV assignment status. Renders nothing for events made in Cwenda (mcv_submitted is null).
const SubmittedBadge = ({ submitted }) => {
    if (submitted == null) return null;
    return (
        <span
            className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${
                submitted ? "bg-[#30d158]/20 text-[#30d158]" : "bg-[#ff9f0a]/20 text-[#ff9f0a]"
            }`}
        >
            {submitted ? "✓ Submitted" : "Not submitted"}
        </span>
    );
};

export default SubmittedBadge;
