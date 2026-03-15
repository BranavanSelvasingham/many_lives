extends PanelContainer

signal policy_draft_changed(character_id: String, draft: Dictionary)
signal policy_save_requested(character_id: String, backend_patch: Dictionary, draft: Dictionary)
signal close_rule_requested

const AUTONOMY_OPTIONS = ["low", "medium", "high"]
const SPEND_OPTIONS = ["0", "50", "200", "custom"]
const INTERRUPT_OPTIONS = ["always", "important_only", "emergencies_only"]
const PRIORITY_OPTIONS = ["work", "family", "money", "health", "relationships"]
const RISK_OPTIONS = ["careful", "balanced", "aggressive"]
const SCHEDULE_OPTIONS = ["strict", "flexible", "opportunistic"]
const REPORTING_OPTIONS = ["minimal", "standard", "detailed"]
const SENSITIVITY_OPTIONS = ["low", "normal", "high"]

@onready var name_label: Label = $Margin/VBox/Header/TitleBox/Name
@onready var subtitle_label: Label = $Margin/VBox/Header/TitleBox/Subtitle
@onready var rule_chip: PillTag = $Margin/VBox/Header/RuleChip
@onready var overview_label: Label = $Margin/VBox/Overview/OverviewText
@onready var priorities_label: Label = $Margin/VBox/Overview/PrioritiesText
@onready var recent_label: Label = $Margin/VBox/Overview/RecentText
@onready var autonomy_option: OptionButton = $Margin/VBox/Editor/Grid/AutonomyOption
@onready var spend_option: OptionButton = $Margin/VBox/Editor/Grid/SpendRow/SpendOption
@onready var custom_spend: SpinBox = $Margin/VBox/Editor/Grid/SpendRow/CustomSpend
@onready var interrupt_option: OptionButton = $Margin/VBox/Editor/Grid/InterruptOption
@onready var priority_option: OptionButton = $Margin/VBox/Editor/Grid/PriorityOption
@onready var risk_option: OptionButton = $Margin/VBox/Editor/Grid/RiskOption
@onready var schedule_option: OptionButton = $Margin/VBox/Editor/Grid/ScheduleOption
@onready var reporting_option: OptionButton = $Margin/VBox/Editor/Grid/ReportingOption
@onready var sensitivity_option: OptionButton = $Margin/VBox/Editor/Grid/SensitivityOption
@onready var rule_text: TextEdit = $Margin/VBox/RuleSection/RuleText
@onready var status_label: Label = $Margin/VBox/Footer/Status
@onready var save_button: Button = $Margin/VBox/Footer/SaveButton
@onready var revert_button: Button = $Margin/VBox/Footer/RevertButton
@onready var close_rule_button: Button = $Margin/VBox/Footer/CloseRuleButton

var _current_character: Dictionary = {}
var _draft: Dictionary = {}
var _rule_context: Dictionary = {}
var _dirty := false
var _syncing := false

func _ready() -> void:
    _populate_options(autonomy_option, AUTONOMY_OPTIONS)
    _populate_options(spend_option, SPEND_OPTIONS)
    _populate_options(interrupt_option, INTERRUPT_OPTIONS)
    _populate_options(priority_option, PRIORITY_OPTIONS)
    _populate_options(risk_option, RISK_OPTIONS)
    _populate_options(schedule_option, SCHEDULE_OPTIONS)
    _populate_options(reporting_option, REPORTING_OPTIONS)
    _populate_options(sensitivity_option, SENSITIVITY_OPTIONS)
    custom_spend.min_value = 0
    custom_spend.max_value = 1000
    custom_spend.step = 10

    autonomy_option.item_selected.connect(_on_control_changed)
    spend_option.item_selected.connect(_on_control_changed)
    custom_spend.value_changed.connect(_on_spin_changed)
    interrupt_option.item_selected.connect(_on_control_changed)
    priority_option.item_selected.connect(_on_control_changed)
    risk_option.item_selected.connect(_on_control_changed)
    schedule_option.item_selected.connect(_on_control_changed)
    reporting_option.item_selected.connect(_on_control_changed)
    sensitivity_option.item_selected.connect(_on_control_changed)
    rule_text.text_changed.connect(_on_text_changed)
    save_button.pressed.connect(_on_save_pressed)
    revert_button.pressed.connect(_on_revert_pressed)
    close_rule_button.pressed.connect(func() -> void:
        close_rule_requested.emit()
    )

func set_character(character: Dictionary, rule_context: Dictionary = {}) -> void:
    if character.is_empty():
        _current_character = {}
        _draft = {}
        _rule_context = {}
        _dirty = false
        name_label.text = "Character Detail"
        subtitle_label.text = "Select a character to review standing policy."
        overview_label.text = "No character selected."
        priorities_label.text = ""
        recent_label.text = ""
        rule_chip.visible = false
        status_label.text = "No policy draft loaded."
        save_button.disabled = true
        revert_button.disabled = true
        close_rule_button.visible = false
        return

    var next_character_id = str(character.get("id", ""))
    var next_rule_id = str(rule_context.get("messageId", ""))
    var should_reset = next_character_id != str(_current_character.get("id", "")) or next_rule_id != str(_rule_context.get("messageId", ""))

    _current_character = character.duplicate(true)
    _rule_context = rule_context.duplicate(true)

    if should_reset or _draft.is_empty():
        _draft = character.get("policy", {}).duplicate(true)
        if not rule_context.is_empty():
            _draft = PolicyModel.prefill_from_message(_draft, rule_context)
        _dirty = false

    name_label.text = str(character.get("name", "Character"))
    subtitle_label.text = str(character.get("subtitle", "Life"))
    overview_label.text = "Now: %s\nNext: %s\nLocation: %s\nStress: %d / Energy: %d\nAutonomy: %s" % [
        str(character.get("currentTask", "Waiting")),
        str(character.get("nextObligation", "No immediate obligation")),
        str(character.get("location", "Unknown")),
        int(character.get("stress", 0)),
        int(character.get("energy", 0)),
        str(character.get("autonomyProfile", "Medium autonomy")),
    ]
    priorities_label.text = "Priorities\n" + _join_lines(character.get("priorities", []))
    recent_label.text = "Recent\n" + _join_lines(character.get("recentEvents", []))

    rule_chip.visible = not rule_context.is_empty()
    if rule_chip.visible:
        rule_chip.set_tag("RULE FROM INBOX", "schedule")
    close_rule_button.visible = rule_chip.visible

    _sync_controls_from_draft()
    _update_status()

func _populate_options(option_button: OptionButton, values: Array) -> void:
    option_button.clear()
    for value in values:
        option_button.add_item(str(value).replace("_", " ").capitalize())
        option_button.set_item_metadata(option_button.item_count - 1, value)

func _join_lines(values: Variant) -> String:
    if not (values is Array):
        return ""

    var lines: Array[String] = []
    for value in values:
        lines.append(str(value))
    return "\n".join(lines)

func _sync_controls_from_draft() -> void:
    _syncing = true
    _select_metadata(autonomy_option, str(_draft.get("autonomy", "medium")))
    _select_metadata(spend_option, str(_draft.get("spendPreset", "custom")))
    custom_spend.value = float(_draft.get("spendWithoutAsking", 50))
    custom_spend.editable = spend_option.get_item_metadata(spend_option.selected) == "custom"
    _select_metadata(interrupt_option, str(_draft.get("interruptWhen", "important_only")))
    _select_metadata(priority_option, str(_draft.get("priorityBias", "work")))
    _select_metadata(risk_option, str(_draft.get("riskTolerance", "balanced")))
    _select_metadata(schedule_option, str(_draft.get("scheduleProtection", "strict")))
    _select_metadata(reporting_option, str(_draft.get("reportingFrequency", "standard")))
    _select_metadata(sensitivity_option, str(_draft.get("escalationSensitivity", "normal")))
    rule_text.text = str(_draft.get("ruleSummary", ""))
    _syncing = false

func _select_metadata(option_button: OptionButton, value: String) -> void:
    for index in range(option_button.item_count):
        if str(option_button.get_item_metadata(index)) == value:
            option_button.select(index)
            return

func _capture_draft_from_controls() -> void:
    if _syncing:
        return

    _draft["autonomy"] = str(autonomy_option.get_item_metadata(autonomy_option.selected))
    _draft["spendPreset"] = str(spend_option.get_item_metadata(spend_option.selected))
    _draft["spendWithoutAsking"] = int(custom_spend.value if _draft["spendPreset"] == "custom" else int(_draft["spendPreset"]))
    _draft["interruptWhen"] = str(interrupt_option.get_item_metadata(interrupt_option.selected))
    _draft["priorityBias"] = str(priority_option.get_item_metadata(priority_option.selected))
    _draft["riskTolerance"] = str(risk_option.get_item_metadata(risk_option.selected))
    _draft["scheduleProtection"] = str(schedule_option.get_item_metadata(schedule_option.selected))
    _draft["reportingFrequency"] = str(reporting_option.get_item_metadata(reporting_option.selected))
    _draft["escalationSensitivity"] = str(sensitivity_option.get_item_metadata(sensitivity_option.selected))
    _draft["ruleSummary"] = rule_text.text.strip_edges()
    custom_spend.editable = _draft["spendPreset"] == "custom"
    _dirty = true
    policy_draft_changed.emit(str(_current_character.get("id", "")), _draft.duplicate(true))
    _update_status()

func _update_status() -> void:
    save_button.disabled = _current_character.is_empty()
    revert_button.disabled = _current_character.is_empty()
    if _current_character.is_empty():
        status_label.text = "No character loaded."
    elif _dirty:
        status_label.text = "Unsaved changes"
    elif not _rule_context.is_empty():
        status_label.text = "Rule draft prefills are ready to save."
    else:
        status_label.text = "Standing policy is synced."

func _on_control_changed(_index: int) -> void:
    _capture_draft_from_controls()

func _on_spin_changed(_value: float) -> void:
    _capture_draft_from_controls()

func _on_text_changed() -> void:
    _capture_draft_from_controls()

func _on_save_pressed() -> void:
    if _current_character.is_empty():
        return
    _dirty = false
    _update_status()
    policy_save_requested.emit(
        str(_current_character.get("id", "")),
        PolicyModel.to_backend_patch(_draft),
        _draft.duplicate(true),
    )

func _on_revert_pressed() -> void:
    _draft = _current_character.get("policy", {}).duplicate(true)
    if not _rule_context.is_empty():
        _draft = PolicyModel.prefill_from_message(_draft, _rule_context)
    _dirty = false
    _sync_controls_from_draft()
    _update_status()
