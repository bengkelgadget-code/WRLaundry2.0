<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
    isOpen: Boolean,
    title: String,
    fields: Array,
    initialData: Object,
    isViewOnly: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['close', 'save']);

const formData = ref({});

watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        if (props.initialData) {
            formData.value = { ...props.initialData };
        } else {
            formData.value = {};
            props.fields.forEach(f => {
                formData.value[f.key] = f.type === 'number' ? 0 : '';
            });
        }
    }
});

const closeModal = () => {
    emit('close');
};

const saveModal = () => {
    emit('save', { ...formData.value });
};
</script>

<template>
    <Teleport to="body">
        <div v-if="isOpen" class="fixed inset-0 z-[99999] flex items-center justify-center fade-in">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="closeModal"></div>
        
        <!-- Modal Panel -->
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col overflow-hidden slide-up">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 class="text-lg font-bold text-slate-800">{{ title }}</h3>
                <button @click="closeModal" class="text-slate-400 hover:text-slate-600 transition-colors">
                    <i class="ph-bold ph-x text-xl"></i>
                </button>
            </div>
            
            <!-- Body -->
            <div class="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-4">
                <div v-for="field in fields" :key="field.key" class="flex flex-col gap-1.5">
                    <label class="text-xs font-bold text-slate-600 uppercase tracking-wide">{{ field.key }}</label>
                    
                    <textarea v-if="field.type === 'textarea'"
                        v-model="formData[field.key]"
                        rows="3"
                        :disabled="isViewOnly"
                        :class="{'bg-slate-100 cursor-not-allowed text-slate-500': isViewOnly}"
                        class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all"></textarea>
                    
                    <select v-else-if="field.type === 'select'"
                        v-model="formData[field.key]"
                        :disabled="isViewOnly"
                        :class="{'bg-slate-100 cursor-not-allowed text-slate-500': isViewOnly}"
                        class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all">
                        <option value="" disabled>-- Pilih {{ field.key }} --</option>
                        <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
                    </select>

                    <input v-else
                        :type="field.type === 'number' ? 'number' : 'text'"
                        v-model="formData[field.key]"
                        :disabled="isViewOnly"
                        :class="{'bg-slate-100 cursor-not-allowed text-slate-500': isViewOnly}"
                        class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all" />
                </div>
            </div>
            
            <!-- Footer -->
            <div class="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                <button @click="closeModal" class="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                    Tutup
                </button>
                <button v-if="!isViewOnly" @click="saveModal" class="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-teal-500 hover:bg-teal-600 shadow-[0_4px_12px_-2px_rgba(20,184,166,0.4)] transition-all flex items-center gap-2 active:scale-95">
                    <i class="ph-bold ph-floppy-disk text-base"></i> Simpan
                </button>
            </div>
        </div>
        </div>
    </Teleport>
</template>

<style scoped>
.fade-in { animation: fadeIn 0.2s ease-out forwards; }
.slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
