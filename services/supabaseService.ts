import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('Supabase configuration is missing. Some features may not work properly.');
  console.warn('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
} else {
  console.warn('Supabase client not initialized due to missing environment variables.');
}

// Define types for our data structures
export interface SystemConfig {
  key: string;
  value: any; // Using any to allow flexible value types (JSON)
  updated_at?: string;
}

export interface AiModel {
  id: string;
  provider: string;
  name: string;
  model_string: string;
  api_key: string;
  is_active: boolean;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  type: string;
  status: string;
  upload_date: string;
  vector_count: number;
  size: string;
  content_url: string;
}

export interface AiRoleAssignment {
  role_key: string;
  model_id: string;
}

/**
 * Get a system configuration value by key
 */
export const getConfig = async (key: string): Promise<any | null> => {
  if (!supabase) {
    console.error('Supabase client not initialized');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('system_configs')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      console.error(`Error getting config for key '${key}':`, error);
      return null;
    }

    return data?.value || null;
  } catch (error) {
    console.error(`Error getting config for key '${key}':`, error);
    return null;
  }
};

/**
 * Update a system configuration value by key
 */
export const updateConfig = async (key: string, value: any): Promise<boolean> => {
  if (!supabase) {
    console.error('Supabase client not initialized');
    return false;
  }

  try {
    // Check if the config key exists
    const { data: existing } = await supabase
      .from('system_configs')
      .select('key')
      .eq('key', key)
      .single();

    let result;
    if (existing) {
      // Update existing record
      result = await supabase
        .from('system_configs')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);
    } else {
      // Insert new record
      result = await supabase
        .from('system_configs')
        .insert([{ key, value, updated_at: new Date().toISOString() }]);
    }

    if (result.error) {
      console.error(`Error updating config for key '${key}':`, result.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error updating config for key '${key}':`, error);
    return false;
  }
};

/**
 * Get all AI models from the database
 */
export const getModels = async (): Promise<AiModel[]> => {
  if (!supabase) {
    console.error('Supabase client not initialized');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error getting AI models:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting AI models:', error);
    return [];
  }
};

/**
 * Update AI models in the database
 */
export const updateModels = async (models: AiModel[]): Promise<boolean> => {
  if (!supabase) {
    console.error('Supabase client not initialized');
    return false;
  }

  try {
    // First, delete all existing models
    const deleteResult = await supabase.from('ai_models').delete().match({});
    
    if (deleteResult.error) {
      console.error('Error deleting existing AI models:', deleteResult.error);
      return false;
    }

    // Then insert the new models
    if (models.length > 0) {
      const insertResult = await supabase.from('ai_models').insert(models);
      
      if (insertResult.error) {
        console.error('Error inserting AI models:', insertResult.error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error updating AI models:', error);
    return false;
  }
};

/**
 * Get all AI role assignments
 */
export const getAiRoles = async (): Promise<Record<string, string>> => {
  if (!supabase) {
    console.error('Supabase client not initialized');
    return {};
  }

  try {
    const { data, error } = await supabase
      .from('ai_role_assignments')
      .select('role_key, model_id');

    if (error) {
      console.error('Error getting AI role assignments:', error);
      return {};
    }

    // Convert array of objects to a dictionary
    const roles: Record<string, string> = {};
    data?.forEach(item => {
      roles[item.role_key] = item.model_id;
    });

    return roles;
  } catch (error) {
    console.error('Error getting AI role assignments:', error);
    return {};
  }
};

/**
 * Update AI role assignments
 */
export const updateAiRoles = async (roles: Record<string, string>): Promise<boolean> => {
  if (!supabase) {
    console.error('Supabase client not initialized');
    return false;
  }

  try {
    // First, delete all existing role assignments
    const deleteResult = await supabase.from('ai_role_assignments').delete().match({});
    
    if (deleteResult.error) {
      console.error('Error deleting existing AI role assignments:', deleteResult.error);
      return false;
    }

    // Then insert the new role assignments
    const roleEntries = Object.entries(roles).map(([roleKey, modelId]) => ({
      role_key: roleKey,
      model_id: modelId
    }));

    if (roleEntries.length > 0) {
      const insertResult = await supabase.from('ai_role_assignments').insert(roleEntries);
      
      if (insertResult.error) {
        console.error('Error inserting AI role assignments:', insertResult.error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error updating AI role assignments:', error);
    return false;
  }
};

/**
 * Initialize default system configurations if they don't exist
 */
export const initializeSystemConfigs = async (): Promise<void> => {
  if (!supabase) {
    console.error('Supabase client not initialized');
    return;
  }

  try {
    // Check if configs already exist
    const { count } = await supabase.from('system_configs').select('*', { count: 'exact' });
    
    if (count && count > 0) {
      // Configs already exist, no need to initialize
      return;
    }

    // Insert default configurations
    const defaultConfigs = [
      {
        key: 'facebook_config',
        value: {
          pageId: process.env.FACEBOOK_PAGE_ID || '',
          accessToken: process.env.FACEBOOK_ACCESS_TOKEN || '',
          pageName: process.env.FACEBOOK_PAGE_NAME || ''
        },
        updated_at: new Date().toISOString()
      },
      {
        key: 'system_prompt',
        value: 'Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật.',
        updated_at: new Date().toISOString()
      }
    ];

    const { error } = await supabase.from('system_configs').insert(defaultConfigs);
    
    if (error) {
      console.error('Error initializing system configs:', error);
    } else {
      console.log('Initialized default system configurations');
    }
  } catch (error) {
    console.error('Error initializing system configs:', error);
  }
};

/**
 * Initialize default AI models if they don't exist
 */
export const initializeAiModels = async (): Promise<void> => {
  if (!supabase) {
    console.error('Supabase client not initialized');
    return;
  }

  try {
    // Check if models already exist
    const { count } = await supabase.from('ai_models').select('*', { count: 'exact' });
    
    if (count && count > 0) {
      // Models already exist, no need to initialize
      return;
    }

    // Insert default AI models
    const defaultModels = [
      {
        id: 'gemini-1',
        provider: 'gemini',
        name: 'Google Gemini',
        model_string: 'gemini-3-flash-preview',
        api_key: process.env.GEMINI_API_KEY || '',
        is_active: true
      },
      {
        id: 'openai-1',
        provider: 'openai',
        name: 'OpenAI',
        model_string: 'gpt-4o',
        api_key: process.env.OPENAI_API_KEY || '',
        is_active: false
      },
      {
        id: 'openrouter-1',
        provider: 'openrouter',
        name: 'OpenRouter',
        model_string: 'openai/whisper-large-v3',
        api_key: process.env.OPENROUTER_API_KEY || '',
        is_active: false
      },
      {
        id: 'hf-1',
        provider: 'huggingface',
        name: 'Hugging Face',
        model_string: 'xiaomi/mimo-v2-flash:free',
        api_key: process.env.HUGGINGFACE_API_KEY || '',
        is_active: false
      }
    ];

    const { error } = await supabase.from('ai_models').insert(defaultModels);
    
    if (error) {
      console.error('Error initializing AI models:', error);
    } else {
      console.log('Initialized default AI models');
    }
  } catch (error) {
    console.error('Error initializing AI models:', error);
  }
};

/**
 * Initialize default AI role assignments if they don't exist
 */
export const initializeAiRoleAssignments = async (): Promise<void> => {
  if (!supabase) {
    console.error('Supabase client not initialized');
    return;
  }

  try {
    // Check if role assignments already exist
    const { count } = await supabase.from('ai_role_assignments').select('*', { count: 'exact' });
    
    if (count && count > 0) {
      // Role assignments already exist, no need to initialize
      return;
    }

    // Insert default AI role assignments
    const defaultRoleAssignments = [
      { role_key: 'chatbotText', model_id: 'gemini-1' },
      { role_key: 'chatbotVision', model_id: 'gemini-1' },
      { role_key: 'chatbotAudio', model_id: 'gemini-1' },
      { role_key: 'rag', model_id: 'openai-1' },
      { role_key: 'analysis', model_id: 'gemini-1' },
      { role_key: 'sentiment', model_id: 'hf-1' }
    ];

    const { error } = await supabase.from('ai_role_assignments').insert(defaultRoleAssignments);
    
    if (error) {
      console.error('Error initializing AI role assignments:', error);
    } else {
      console.log('Initialized default AI role assignments');
    }
  } catch (error) {
    console.error('Error initializing AI role assignments:', error);
  }
};

/**
 * Initialize all system data if tables are empty
 */
export const initializeSystemData = async (): Promise<void> => {
  await initializeSystemConfigs();
  await initializeAiModels();
  await initializeAiRoleAssignments();
};

export default supabase;