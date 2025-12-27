import { Client } from 'pg';

// Initialize PostgreSQL client using connection string
const connectionString = process.env.SUPABASE_URL;

if (!connectionString) {
  console.warn('PostgreSQL connection string is missing. Some features may not work properly.');
  console.warn('Please set SUPABASE_URL environment variable.');
}

let pgClient: Client | null = null;

if (connectionString && connectionString !== 'postgresql://postgres.smtqevkyhttclmpwsmvc:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres') {
  pgClient = new Client({
    connectionString: connectionString,
  });

  pgClient.connect()
    .then(() => {
      console.log('Connected to PostgreSQL database');
    })
    .catch(err => {
      console.error('Error connecting to PostgreSQL database:', err);
    });
} else {
  console.warn('PostgreSQL client not initialized due to missing or default environment variables.');
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
  if (!pgClient) {
    console.error('PostgreSQL client not initialized');
    return null;
  }

  try {
    const result = await pgClient.query(
      'SELECT value FROM system_configs WHERE key = $1',
      [key]
    );

    if (result.rows.length > 0) {
      return result.rows[0].value;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error getting config for key '${key}':`, error);
    return null;
  }
};

/**
 * Update a system configuration value by key
 */
export const updateConfig = async (key: string, value: any): Promise<boolean> => {
  if (!pgClient) {
    console.error('PostgreSQL client not initialized');
    return false;
  }

  try {
    // Check if the config key exists
    const checkResult = await pgClient.query(
      'SELECT key FROM system_configs WHERE key = $1',
      [key]
    );

    let result;
    if (checkResult.rows.length > 0) {
      // Update existing record
      result = await pgClient.query(
        'UPDATE system_configs SET value = $1, updated_at = $2 WHERE key = $3',
        [value, new Date().toISOString(), key]
      );
    } else {
      // Insert new record
      result = await pgClient.query(
        'INSERT INTO system_configs (key, value, updated_at) VALUES ($1, $2, $3)',
        [key, value, new Date().toISOString()]
      );
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
  if (!pgClient) {
    console.error('PostgreSQL client not initialized');
    return [];
  }

  try {
    const result = await pgClient.query(
      'SELECT id, provider, name, model_string, api_key, is_active FROM ai_models ORDER BY name ASC'
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting AI models:', error);
    return [];
  }
};

/**
 * Update AI models in the database
 */
export const updateModels = async (models: AiModel[]): Promise<{ success: boolean; error?: string }> => {
  if (!pgClient) {
    console.error('PostgreSQL client not initialized');
    return { success: false, error: 'PostgreSQL client not initialized' };
  }

  const client = pgClient;

  try {
    console.log('=== Starting updateModels transaction ===');
    console.log('Models to update:', JSON.stringify(models, null, 2));

    // Begin transaction
    await client.query('BEGIN');

    // First, delete all existing models
    const deleteResult = await client.query('DELETE FROM ai_models');
    console.log(`Deleted ${deleteResult.rowCount} existing models`);

    // Then insert the new models
    if (models.length > 0) {
      for (const model of models) {
        console.log(`Processing model: ${model.id} - ${model.name}`);

        // Validate required fields
        if (!model.id || !model.provider || !model.name || !model.model_string) {
          console.error('Invalid model data:', model);
          throw new Error(`Invalid model data for ${model.name}: missing required fields`);
        }

        // Validate provider
        const validProviders = ['gemini', 'openai', 'openrouter', 'huggingface'];
        if (!validProviders.includes(model.provider.toLowerCase())) {
          throw new Error(`Invalid provider: ${model.provider}`);
        }

        // Use API key from environment variable
        // The UI no longer sends API keys, so we always use environment variables
        let apiKey = '';
        switch (model.provider.toLowerCase()) {
          case 'gemini':
            apiKey = process.env.GEMINI_API_KEY || '';
            if (!apiKey) console.warn(`Warning: GEMINI_API_KEY not set for ${model.name}`);
            break;
          case 'openai':
            apiKey = process.env.OPENAI_API_KEY || '';
            if (!apiKey) console.warn(`Warning: OPENAI_API_KEY not set for ${model.name}`);
            break;
          case 'openrouter':
            apiKey = process.env.OPENROUTER_API_KEY || '';
            if (!apiKey) console.warn(`Warning: OPENROUTER_API_KEY not set for ${model.name}`);
            break;
          case 'huggingface':
            apiKey = process.env.HUGGINGFACE_API_KEY || '';
            if (!apiKey) console.warn(`Warning: HUGGINGFACE_API_KEY not set for ${model.name}`);
            break;
          default:
            apiKey = '';
        }

        const insertResult = await client.query(
          'INSERT INTO ai_models (id, provider, name, model_string, api_key, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [model.id, model.provider, model.name, model.model_string, apiKey, model.is_active]
        );
        console.log(`✓ Inserted model: ${model.name} (ID: ${model.id}, Active: ${model.is_active})`);
      }
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log(`✓ Successfully updated ${models.length} AI models`);
    console.log('=== updateModels transaction completed successfully ===');

    return { success: true };
  } catch (error: any) {
    console.error('=== Error updating AI models ===');
    console.error('Error details:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);

    // Rollback transaction
    try {
      await client.query('ROLLBACK');
      console.log('Transaction rolled back due to error');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }

    return {
      success: false,
      error: error?.message || 'Unknown error updating models'
    };
  }
};

/**
 * Get all AI role assignments
 */
export const getAiRoles = async (): Promise<Record<string, string>> => {
  if (!pgClient) {
    console.error('PostgreSQL client not initialized');
    return {};
  }

  try {
    const result = await pgClient.query(
      'SELECT role_key, model_id FROM ai_role_assignments'
    );

    // Convert array of objects to a dictionary
    const roles: Record<string, string> = {};
    result.rows.forEach(item => {
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
  if (!pgClient) {
    console.error('PostgreSQL client not initialized');
    return false;
  }

  try {
    // Begin transaction
    await pgClient.query('BEGIN');

    // First, delete all existing role assignments
    await pgClient.query('DELETE FROM ai_role_assignments');

    // Then insert the new role assignments
    const roleEntries = Object.entries(roles);
    if (roleEntries.length > 0) {
      for (const [roleKey, modelId] of roleEntries) {
        await pgClient.query(
          'INSERT INTO ai_role_assignments (role_key, model_id) VALUES ($1, $2)',
          [roleKey, modelId]
        );
      }
    }

    // Commit transaction
    await pgClient.query('COMMIT');

    return true;
  } catch (error) {
    console.error('Error updating AI role assignments:', error);
    try {
      await pgClient.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    return false;
  }
};

/**
 * Initialize default system configurations if they don't exist
 */
export const initializeSystemConfigs = async (): Promise<void> => {
  if (!pgClient) {
    console.error('PostgreSQL client not initialized');
    return;
  }

  try {
    // Check if configs already exist
    const result = await pgClient.query(
      'SELECT COUNT(*) FROM system_configs'
    );
    
    const count = parseInt(result.rows[0].count);
    if (count > 0) {
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

    for (const config of defaultConfigs) {
      await pgClient.query(
        'INSERT INTO system_configs (key, value, updated_at) VALUES ($1, $2, $3)',
        [config.key, config.value, config.updated_at]
      );
    }
    
    console.log('Initialized default system configurations');
  } catch (error) {
    console.error('Error initializing system configs:', error);
  }
};

/**
 * Initialize default AI models if they don't exist
 */
export const initializeAiModels = async (): Promise<void> => {
  if (!pgClient) {
    console.error('PostgreSQL client not initialized');
    return;
  }

  try {
    // Check if models already exist
    const result = await pgClient.query(
      'SELECT COUNT(*) FROM ai_models'
    );

    const count = parseInt(result.rows[0].count);
    if (count > 0) {
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
        model_string: 'xiaomi/mimo-v2-flash:free',
        api_key: process.env.OPENROUTER_API_KEY || '',
        is_active: false
      },
      {
        id: 'hf-1',
        provider: 'huggingface',
        name: 'Hugging Face',
        model_string: 'zai-org/GLM-4.7',
        api_key: process.env.HUGGINGFACE_API_KEY || '',
        is_active: false
      },
      {
        id: 'hf-2',
        provider: 'huggingface',
        name: 'Google Gemma (HuggingFace)',
        model_string: 'google/gemma-3-300m',
        api_key: process.env.HUGGINGFACE_API_KEY || '',
        is_active: false
      }
    ];

    for (const model of defaultModels) {
      await pgClient.query(
        'INSERT INTO ai_models (id, provider, name, model_string, api_key, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
        [model.id, model.provider, model.name, model.model_string, model.api_key, model.is_active]
      );
    }

    console.log('Initialized default AI models');
  } catch (error) {
    console.error('Error initializing AI models:', error);
  }
};

/**
 * Initialize default AI role assignments if they don't exist
 */
export const initializeAiRoleAssignments = async (): Promise<void> => {
  if (!pgClient) {
    console.error('PostgreSQL client not initialized');
    return;
  }

  try {
    // Check if role assignments already exist
    const result = await pgClient.query(
      'SELECT COUNT(*) FROM ai_role_assignments'
    );
    
    const count = parseInt(result.rows[0].count);
    if (count > 0) {
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

    for (const assignment of defaultRoleAssignments) {
      await pgClient.query(
        'INSERT INTO ai_role_assignments (role_key, model_id) VALUES ($1, $2)',
        [assignment.role_key, assignment.model_id]
      );
    }
    
    console.log('Initialized default AI role assignments');
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

export default pgClient;