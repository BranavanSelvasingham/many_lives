class_name ActionButtonRow
extends HFlowContainer

signal action_pressed(action_id: String)

func set_actions(
    actions: Array,
    selected_action_id: String = "",
    compact: bool = true,
    selection_mode: bool = false,
) -> void:
    for child in get_children():
        child.queue_free()

    for action in actions:
        if not (action is Dictionary):
            continue

        var button := Button.new()
        var action_id := str(action.get("id", "action"))
        button.text = str(action.get("label", action_id))
        button.tooltip_text = button.text
        button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
        button.toggle_mode = selection_mode
        button.button_pressed = selection_mode and action_id == selected_action_id
        button.add_theme_stylebox_override("normal", ThemeFactory.button_style(false))
        button.add_theme_stylebox_override("hover", ThemeFactory.button_style(true))
        button.add_theme_stylebox_override("pressed", ThemeFactory.button_style(true, true))

        if compact:
            button.add_theme_font_size_override("font_size", 12)
            button.custom_minimum_size = Vector2(96, 28)
        else:
            button.custom_minimum_size = Vector2(120, 34)

        button.pressed.connect(_on_button_pressed.bind(action_id))
        add_child(button)

func _on_button_pressed(action_id: String) -> void:
    action_pressed.emit(action_id)
