// Form Builder Module

const FormBuilder = {
    currentForm: null,
    fields: [],
    isEditing: false,

    // Field type definitions
    fieldTypes: {
        text: { label: 'Text', icon: '📝', hasChoices: false },
        email: { label: 'Email', icon: '📧', hasChoices: false },
        number: { label: 'Number', icon: '🔢', hasChoices: false },
        date: { label: 'Date', icon: '📅', hasChoices: false },
        long_text: { label: 'Long Text', icon: '📄', hasChoices: false },
        multiple_choice: { label: 'Multiple Choice', icon: '🔘', hasChoices: true },
        checkbox: { label: 'Checkbox', icon: '☑️', hasChoices: true },
        dropdown: { label: 'Dropdown', icon: '📋', hasChoices: true },
        file: { label: 'File Upload', icon: '📎', hasChoices: false },
        rating: { label: 'Rating', icon: '⭐', hasChoices: false }
    },

    // Initialize builder
    async init(formId = null) {
        if (formId) {
            await this.loadForm(formId);
            this.isEditing = true;
        } else {
            this.currentForm = {
                code: Utils.generateFormCode(),
                title: '',
                description: '',
                is_published: false
            };
            this.fields = [];
            this.isEditing = false;
        }
    },

    // Load existing form
    async loadForm(formId) {
        const { data: form, error: formError } = await db
            .from('forms')
            .select('*')
            .eq('id', formId)
            .single();

        if (formError) throw formError;
        this.currentForm = form;

        // Load fields
        const { data: fields, error: fieldsError } = await db
            .from('fields')
            .select('*')
            .eq('form_id', formId)
            .order('position', { ascending: true });

        if (fieldsError) throw fieldsError;

        // Load choices
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
        this.fields = fields.map(field => ({
            ...field,
            choices: choices.filter(c => c.field_id === field.id)
        }));
    },

    // Add new field
    addField(fieldType) {
        const typeInfo = this.fieldTypes[fieldType];
        if (!typeInfo) return;

        const field = {
            tempId: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            code: Utils.generateFieldCode(),
            field_type: fieldType,
            label: `New ${typeInfo.label} Field`,
            description: '',
            is_required: false,
            position: this.fields.length,
            settings: this.getDefaultSettings(fieldType),
            choices: []
        };

        // Add default choices for choice-based fields
        if (typeInfo.hasChoices) {
            field.choices = [
                { tempId: 'temp_c1', code: Utils.generateChoiceCode(), label: 'Option 1', image_url: null, position: 0, has_text_input: false, text_input_type: 'text', text_input_placeholder: '' },
                { tempId: 'temp_c2', code: Utils.generateChoiceCode(), label: 'Option 2', image_url: null, position: 1, has_text_input: false, text_input_type: 'text', text_input_placeholder: '' }
            ];
        }

        this.fields.push(field);
        return field;
    },

    // Get default settings per field type
    getDefaultSettings(fieldType) {
        const defaults = {
            rating: { min: 1, max: 5 },
            number: { min: null, max: null },
            long_text: { rows: 4, maxLength: null },
            file: { accept: '' }
        };
        return defaults[fieldType] || {};
    },

    // Update field
    updateField(fieldTempIdOrId, updates) {
        const index = this.fields.findIndex(f => f.tempId === fieldTempIdOrId || f.id === fieldTempIdOrId);
        if (index !== -1) {
            this.fields[index] = { ...this.fields[index], ...updates };
        }
    },

    // Delete field
    deleteField(fieldTempIdOrId) {
        const index = this.fields.findIndex(f => f.tempId === fieldTempIdOrId || f.id === fieldTempIdOrId);
        if (index !== -1) {
            // Delete associated images
            const field = this.fields[index];
            if (field.choices) {
                field.choices.forEach(choice => {
                    if (choice.image_url) {
                        Storage.deleteChoiceImage(choice.image_url);
                    }
                });
            }
            this.fields.splice(index, 1);
            // Update positions
            this.fields.forEach((f, i) => f.position = i);
        }
    },

    // Move field
    moveField(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.fields.length) return;
        if (toIndex < 0 || toIndex >= this.fields.length) return;

        const [field] = this.fields.splice(fromIndex, 1);
        this.fields.splice(toIndex, 0, field);

        // Update positions
        this.fields.forEach((f, i) => f.position = i);
    },

    // Add choice to field
    addChoice(fieldTempIdOrId) {
        const field = this.fields.find(f => f.tempId === fieldTempIdOrId || f.id === fieldTempIdOrId);
        if (!field || !field.choices) return;

        const choice = {
            tempId: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            code: Utils.generateChoiceCode(),
            label: `Option ${field.choices.length + 1}`,
            image_url: null,
            position: field.choices.length,
            has_text_input: false,
            text_input_type: 'text',
            text_input_placeholder: ''
        };

        field.choices.push(choice);
        return choice;
    },

    // Update choice
    updateChoice(fieldTempIdOrId, choiceTempIdOrId, updates) {
        const field = this.fields.find(f => f.tempId === fieldTempIdOrId || f.id === fieldTempIdOrId);
        if (!field || !field.choices) return;

        const choiceIndex = field.choices.findIndex(c => c.tempId === choiceTempIdOrId || c.id === choiceTempIdOrId);
        if (choiceIndex !== -1) {
            field.choices[choiceIndex] = { ...field.choices[choiceIndex], ...updates };
        }
    },

    // Delete choice
    deleteChoice(fieldTempIdOrId, choiceTempIdOrId) {
        const field = this.fields.find(f => f.tempId === fieldTempIdOrId || f.id === fieldTempIdOrId);
        if (!field || !field.choices) return;

        const choiceIndex = field.choices.findIndex(c => c.tempId === choiceTempIdOrId || c.id === choiceTempIdOrId);
        if (choiceIndex !== -1) {
            // Delete image if exists
            const choice = field.choices[choiceIndex];
            if (choice.image_url) {
                Storage.deleteChoiceImage(choice.image_url);
            }
            field.choices.splice(choiceIndex, 1);
            // Update positions
            field.choices.forEach((c, i) => c.position = i);
        }
    },

    // Validate form
    validate() {
        const errors = [];

        if (!this.currentForm.title || !this.currentForm.title.trim()) {
            errors.push('Le titre du formulaire est requis');
        }

        if (this.fields.length === 0) {
            errors.push('Le formulaire doit avoir au moins un champ');
        }

        // Check each field
        this.fields.forEach((field, index) => {
            if (!field.label || !field.label.trim()) {
                errors.push(`Champ ${index + 1} : Le libellé est requis`);
            }

            // Check choices for choice-based fields
            const typeInfo = this.fieldTypes[field.field_type];
            if (typeInfo && typeInfo.hasChoices) {
                if (!field.choices || field.choices.length < 2) {
                    errors.push(`Champ "${field.label}" : Doit avoir au moins 2 options`);
                } else {
                    field.choices.forEach((choice, cIndex) => {
                        if (!choice.label || !choice.label.trim()) {
                            errors.push(`Champ "${field.label}", Option ${cIndex + 1} : Le libellé est requis`);
                        }
                    });
                }
            }
        });

        return errors;
    },

    // Save form to database
    async save() {
        const user = await Auth.getUser();
        if (!user) throw new Error('Non authentifié');

        // Validate
        const errors = this.validate();
        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }

        let formId = this.currentForm.id;

        // Create or update form
        if (!formId) {
            // Create new form
            const { data: form, error } = await db
                .from('forms')
                .insert({
                    code: this.currentForm.code,
                    title: this.currentForm.title.trim(),
                    description: this.currentForm.description?.trim() || null,
                    is_published: this.currentForm.is_published,
                    created_by: user.id
                })
                .select()
                .single();

            if (error) throw error;
            formId = form.id;
            this.currentForm.id = formId;
        } else {
            // Update existing form
            const { error } = await db
                .from('forms')
                .update({
                    title: this.currentForm.title.trim(),
                    description: this.currentForm.description?.trim() || null,
                    is_published: this.currentForm.is_published,
                    updated_at: new Date().toISOString()
                })
                .eq('id', formId);

            if (error) throw error;

            // Delete existing fields (cascade will delete choices)
            await db.from('fields').delete().eq('form_id', formId);
        }

        // Insert all fields
        for (const field of this.fields) {
            const { data: savedField, error: fieldError } = await db
                .from('fields')
                .insert({
                    code: field.code,
                    form_id: formId,
                    field_type: field.field_type,
                    label: field.label.trim(),
                    description: field.description?.trim() || null,
                    is_required: field.is_required,
                    position: field.position,
                    settings: field.settings || {}
                })
                .select()
                .single();

            if (fieldError) throw fieldError;

            // Update field with saved id
            field.id = savedField.id;
            delete field.tempId;

            // Insert choices
            if (field.choices && field.choices.length > 0) {
                const choicesToInsert = field.choices.map(c => ({
                    code: c.code,
                    field_id: savedField.id,
                    label: c.label.trim(),
                    image_url: c.image_url,
                    position: c.position,
                    has_text_input: c.has_text_input || false,
                    text_input_type: c.text_input_type || 'text',
                    text_input_placeholder: c.text_input_placeholder || ''
                }));

                const { data: savedChoices, error: choicesError } = await db
                    .from('choices')
                    .insert(choicesToInsert)
                    .select();

                if (choicesError) throw choicesError;

                // Update choices with saved ids
                savedChoices.forEach((sc, i) => {
                    field.choices[i].id = sc.id;
                    delete field.choices[i].tempId;
                });
            }
        }

        this.isEditing = true;
        return formId;
    }
};
