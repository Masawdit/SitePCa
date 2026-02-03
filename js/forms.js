// Forms Module - Load and render forms

const Forms = {
    // Load all published forms
    async loadPublishedForms() {
        const { data, error } = await db
            .from('forms')
            .select('*')
            .eq('is_published', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    // Load a single form with its fields and choices
    async loadForm(formId) {
        // Load form
        const { data: form, error: formError } = await db
            .from('forms')
            .select('*')
            .eq('id', formId)
            .single();

        if (formError) throw formError;

        // Load fields
        const { data: fields, error: fieldsError } = await db
            .from('fields')
            .select('*')
            .eq('form_id', formId)
            .order('position', { ascending: true });

        if (fieldsError) throw fieldsError;

        // Load choices for all fields
        const fieldIds = fields.map(f => f.id);
        let choices = [];

        if (fieldIds.length > 0) {
            const { data: choicesData, error: choicesError } = await db
                .from('choices')
                .select('*')
                .in('field_id', fieldIds)
                .order('position', { ascending: true });

            if (choicesError) throw choicesError;
            choices = choicesData || [];
        }

        // Attach choices to fields
        const fieldsWithChoices = fields.map(field => ({
            ...field,
            choices: choices.filter(c => c.field_id === field.id)
        }));

        return { form, fields: fieldsWithChoices };
    },

    // Submit form response
    async submitResponse(formId, responseData) {
        const { data, error } = await db
            .from('responses')
            .insert({
                form_id: formId,
                response_data: responseData
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};

// Field Renderers - Generate HTML for each field type
const FieldRenderers = {
    text(field) {
        return `
            <div class="form-field" data-field-id="${field.id}" data-field-code="${field.code}">
                <label class="field-label" for="${field.code}">
                    ${Utils.escapeHtml(field.label)}${field.is_required ? ' <span class="required">*</span>' : ''}
                </label>
                ${field.description ? `<p class="field-description">${Utils.escapeHtml(field.description)}</p>` : ''}
                <input type="text"
                       id="${field.code}"
                       name="${field.code}"
                       class="form-input"
                       ${field.is_required ? 'required' : ''}>
            </div>
        `;
    },

    email(field) {
        return `
            <div class="form-field" data-field-id="${field.id}" data-field-code="${field.code}">
                <label class="field-label" for="${field.code}">
                    ${Utils.escapeHtml(field.label)}${field.is_required ? ' <span class="required">*</span>' : ''}
                </label>
                ${field.description ? `<p class="field-description">${Utils.escapeHtml(field.description)}</p>` : ''}
                <input type="email"
                       id="${field.code}"
                       name="${field.code}"
                       class="form-input"
                       ${field.is_required ? 'required' : ''}>
            </div>
        `;
    },

    number(field) {
        const settings = field.settings || {};
        return `
            <div class="form-field" data-field-id="${field.id}" data-field-code="${field.code}">
                <label class="field-label" for="${field.code}">
                    ${Utils.escapeHtml(field.label)}${field.is_required ? ' <span class="required">*</span>' : ''}
                </label>
                ${field.description ? `<p class="field-description">${Utils.escapeHtml(field.description)}</p>` : ''}
                <input type="number"
                       id="${field.code}"
                       name="${field.code}"
                       class="form-input"
                       ${settings.min !== undefined && settings.min !== null ? `min="${settings.min}"` : ''}
                       ${settings.max !== undefined && settings.max !== null ? `max="${settings.max}"` : ''}
                       ${field.is_required ? 'required' : ''}>
            </div>
        `;
    },

    date(field) {
        return `
            <div class="form-field" data-field-id="${field.id}" data-field-code="${field.code}">
                <label class="field-label" for="${field.code}">
                    ${Utils.escapeHtml(field.label)}${field.is_required ? ' <span class="required">*</span>' : ''}
                </label>
                ${field.description ? `<p class="field-description">${Utils.escapeHtml(field.description)}</p>` : ''}
                <input type="date"
                       id="${field.code}"
                       name="${field.code}"
                       class="form-input"
                       ${field.is_required ? 'required' : ''}>
            </div>
        `;
    },

    long_text(field) {
        const settings = field.settings || {};
        return `
            <div class="form-field" data-field-id="${field.id}" data-field-code="${field.code}">
                <label class="field-label" for="${field.code}">
                    ${Utils.escapeHtml(field.label)}${field.is_required ? ' <span class="required">*</span>' : ''}
                </label>
                ${field.description ? `<p class="field-description">${Utils.escapeHtml(field.description)}</p>` : ''}
                <textarea id="${field.code}"
                          name="${field.code}"
                          class="form-textarea"
                          rows="${settings.rows || 4}"
                          ${settings.maxLength ? `maxlength="${settings.maxLength}"` : ''}
                          ${field.is_required ? 'required' : ''}></textarea>
            </div>
        `;
    },

    multiple_choice(field) {
        const choicesHtml = (field.choices || []).map(choice => `
            <label class="choice-option ${choice.image_url ? 'has-image' : ''}" data-choice-code="${choice.code}">
                <input type="radio"
                       name="${field.code}"
                       value="${choice.code}"
                       ${choice.image_url ? `data-image="${choice.image_url}"` : ''}
                       ${field.is_required ? 'required' : ''}>
                <span class="choice-radio"></span>
                <span class="choice-label">${Utils.escapeHtml(choice.label)}</span>
            </label>
        `).join('');

        return `
            <div class="form-field field-multiple-choice" data-field-id="${field.id}" data-field-code="${field.code}">
                <label class="field-label">
                    ${Utils.escapeHtml(field.label)}${field.is_required ? ' <span class="required">*</span>' : ''}
                </label>
                ${field.description ? `<p class="field-description">${Utils.escapeHtml(field.description)}</p>` : ''}
                <div class="choices-container">${choicesHtml}</div>
                <div class="selected-image-preview"></div>
            </div>
        `;
    },

    checkbox(field) {
        const choicesHtml = (field.choices || []).map(choice => `
            <label class="choice-option" data-choice-code="${choice.code}">
                <input type="checkbox"
                       name="${field.code}"
                       value="${choice.code}">
                <span class="choice-checkbox"></span>
                <span class="choice-label">${Utils.escapeHtml(choice.label)}</span>
            </label>
        `).join('');

        return `
            <div class="form-field field-checkbox" data-field-id="${field.id}" data-field-code="${field.code}">
                <label class="field-label">
                    ${Utils.escapeHtml(field.label)}${field.is_required ? ' <span class="required">*</span>' : ''}
                </label>
                ${field.description ? `<p class="field-description">${Utils.escapeHtml(field.description)}</p>` : ''}
                <div class="choices-container">${choicesHtml}</div>
            </div>
        `;
    },

    dropdown(field) {
        const optionsHtml = (field.choices || []).map(choice =>
            `<option value="${choice.code}">${Utils.escapeHtml(choice.label)}</option>`
        ).join('');

        return `
            <div class="form-field" data-field-id="${field.id}" data-field-code="${field.code}">
                <label class="field-label" for="${field.code}">
                    ${Utils.escapeHtml(field.label)}${field.is_required ? ' <span class="required">*</span>' : ''}
                </label>
                ${field.description ? `<p class="field-description">${Utils.escapeHtml(field.description)}</p>` : ''}
                <select id="${field.code}"
                        name="${field.code}"
                        class="form-select"
                        ${field.is_required ? 'required' : ''}>
                    <option value="">-- Select an option --</option>
                    ${optionsHtml}
                </select>
            </div>
        `;
    },

    file(field) {
        const settings = field.settings || {};
        return `
            <div class="form-field" data-field-id="${field.id}" data-field-code="${field.code}">
                <label class="field-label" for="${field.code}">
                    ${Utils.escapeHtml(field.label)}${field.is_required ? ' <span class="required">*</span>' : ''}
                </label>
                ${field.description ? `<p class="field-description">${Utils.escapeHtml(field.description)}</p>` : ''}
                <input type="file"
                       id="${field.code}"
                       name="${field.code}"
                       class="form-input form-file"
                       ${settings.accept ? `accept="${settings.accept}"` : ''}
                       ${field.is_required ? 'required' : ''}>
            </div>
        `;
    },

    rating(field) {
        const settings = field.settings || { min: 1, max: 5 };
        const min = settings.min || 1;
        const max = settings.max || 5;

        let starsHtml = '';
        for (let i = min; i <= max; i++) {
            starsHtml += `
                <label class="rating-option">
                    <input type="radio"
                           name="${field.code}"
                           value="${i}"
                           ${field.is_required ? 'required' : ''}>
                    <span class="rating-star" data-value="${i}">${i}</span>
                </label>
            `;
        }

        return `
            <div class="form-field field-rating" data-field-id="${field.id}" data-field-code="${field.code}">
                <label class="field-label">
                    ${Utils.escapeHtml(field.label)}${field.is_required ? ' <span class="required">*</span>' : ''}
                </label>
                ${field.description ? `<p class="field-description">${Utils.escapeHtml(field.description)}</p>` : ''}
                <div class="rating-container">${starsHtml}</div>
            </div>
        `;
    },

    // Render a field based on its type
    render(field) {
        const renderer = this[field.field_type];
        if (renderer) {
            return renderer.call(this, field);
        }
        return `<div class="form-field"><p class="text-muted">Unknown field type: ${field.field_type}</p></div>`;
    }
};
