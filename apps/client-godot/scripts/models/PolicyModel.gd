class_name PolicyModel
extends RefCounted

static func from_raw(raw_policy: Dictionary) -> Dictionary:
    var spending_limit = int(raw_policy.get("spendingLimit", 100))
    return {
        "autonomy": _autonomy_from_raw(raw_policy),
        "spendWithoutAsking": spending_limit,
        "spendPreset": _spend_preset(spending_limit),
        "interruptWhen": _interrupt_mode_from_raw(raw_policy),
        "priorityBias": _priority_bias_from_raw(raw_policy),
        "riskTolerance": _risk_label_from_raw(raw_policy),
        "scheduleProtection": _schedule_mode_from_raw(raw_policy),
        "reportingFrequency": _reporting_frequency_from_raw(raw_policy),
        "escalationSensitivity": _sensitivity_from_raw(raw_policy),
        "ruleSummary": "",
    }

static func to_backend_patch(draft: Dictionary) -> Dictionary:
    var spending_limit = int(draft.get("spendWithoutAsking", 50))
    var interrupt_mode = str(draft.get("interruptWhen", "important_only"))
    var escalation_sensitivity = str(draft.get("escalationSensitivity", "normal"))
    var schedule_protection = str(draft.get("scheduleProtection", "strict"))

    var threshold = 4
    match interrupt_mode:
        "always":
            threshold = 2
        "important_only":
            threshold = 3
        "emergencies_only":
            threshold = 5

    match escalation_sensitivity:
        "high":
            threshold -= 1
        "low":
            threshold += 1

    match schedule_protection:
        "strict":
            threshold -= 1
        "opportunistic":
            threshold += 1

    return {
        "spendingLimit": spending_limit,
        "priorityBias": _backend_priority_bias(str(draft.get("priorityBias", "work"))),
        "riskTolerance": _risk_value(str(draft.get("riskTolerance", "balanced")), str(draft.get("autonomy", "medium"))),
        "reportingFrequency": _backend_reporting_frequency(str(draft.get("reportingFrequency", "standard"))),
        "escalationThreshold": int(clamp(threshold, 1, 6)),
    }

static func prefill_from_message(draft: Dictionary, message: Dictionary) -> Dictionary:
    var next_draft = draft.duplicate(true)
    var consequences: Dictionary = message.get("consequences", {})
    var subject = str(message.get("subject", "this issue"))

    if str(consequences.get("schedule", "none")) == "high":
        next_draft["scheduleProtection"] = "strict"
        next_draft["interruptWhen"] = "important_only"

    if str(consequences.get("money", "none")) == "high":
        next_draft["spendWithoutAsking"] = 50
        next_draft["spendPreset"] = "50"

    if str(consequences.get("relationship", "none")) == "high":
        next_draft["priorityBias"] = "family"

    if str(consequences.get("stress", "none")) in ["medium", "high"]:
        next_draft["reportingFrequency"] = "detailed"
        next_draft["autonomy"] = "medium"

    next_draft["ruleSummary"] = "When %s appears, protect the most fragile commitment first." % subject.to_lower()
    return next_draft

static func describe_autonomy_profile(draft: Dictionary) -> String:
    return "%s autonomy, %s interruption, %s schedule protection" % [
        str(draft.get("autonomy", "medium")).capitalize(),
        _humanize_token(str(draft.get("interruptWhen", "important_only"))),
        str(draft.get("scheduleProtection", "strict")).capitalize(),
    ]

static func _autonomy_from_raw(raw_policy: Dictionary) -> String:
    var risk_tolerance = float(raw_policy.get("riskTolerance", 0.5))
    if risk_tolerance <= 0.3:
        return "low"
    if risk_tolerance >= 0.7:
        return "high"
    return "medium"

static func _interrupt_mode_from_raw(raw_policy: Dictionary) -> String:
    var threshold = int(raw_policy.get("escalationThreshold", 3))
    if threshold <= 2:
        return "always"
    if threshold >= 5:
        return "emergencies_only"
    return "important_only"

static func _priority_bias_from_raw(raw_policy: Dictionary) -> String:
    return str(raw_policy.get("priorityBias", "work"))

static func _risk_label_from_raw(raw_policy: Dictionary) -> String:
    var risk_tolerance = float(raw_policy.get("riskTolerance", 0.5))
    if risk_tolerance <= 0.3:
        return "careful"
    if risk_tolerance >= 0.7:
        return "aggressive"
    return "balanced"

static func _schedule_mode_from_raw(raw_policy: Dictionary) -> String:
    var threshold = int(raw_policy.get("escalationThreshold", 3))
    if threshold <= 2:
        return "strict"
    if threshold >= 5:
        return "opportunistic"
    return "flexible"

static func _reporting_frequency_from_raw(raw_policy: Dictionary) -> String:
    match str(raw_policy.get("reportingFrequency", "normal")):
        "high":
            return "detailed"
        "low":
            return "minimal"
        _:
            return "standard"

static func _sensitivity_from_raw(raw_policy: Dictionary) -> String:
    var threshold = int(raw_policy.get("escalationThreshold", 3))
    if threshold <= 2:
        return "high"
    if threshold >= 5:
        return "low"
    return "normal"

static func _spend_preset(spending_limit: int) -> String:
    if spending_limit == 0:
        return "0"
    if spending_limit == 50:
        return "50"
    if spending_limit == 200:
        return "200"
    return "custom"

static func _backend_priority_bias(priority_bias: String) -> String:
    if priority_bias == "relationships":
        return "family"
    return priority_bias

static func _risk_value(risk_label: String, autonomy: String) -> float:
    match risk_label:
        "careful":
            return 0.2
        "aggressive":
            return 0.8
        _:
            match autonomy:
                "low":
                    return 0.35
                "high":
                    return 0.7
                _:
                    return 0.5

static func _backend_reporting_frequency(reporting_frequency: String) -> String:
    match reporting_frequency:
        "minimal":
            return "low"
        "detailed":
            return "high"
        _:
            return "normal"

static func _humanize_token(token: String) -> String:
    return token.replace("_", " ")
