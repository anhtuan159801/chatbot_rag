import dotenv from 'dotenv';
import { ragService } from './services/ragService.js';

dotenv.config();

async function testRAGSearch() {
  const query = 'Hướng dẫn xét công nhân liệt sĩ';

  console.log('🔍 Testing RAG search with query:', query);
  console.log('========================\n');

  try {
    const chunks = await ragService.searchKnowledge(query, 3);

    if (chunks.length === 0) {
      console.log('⚠️ No chunks found (this was the original problem)');
    } else {
      console.log(`✅ SUCCESS! Found ${chunks.length} relevant chunks:\n`);
      chunks.forEach((chunk, index) => {
        console.log(`\n[CHUNK ${index + 1}]`);
        console.log(`ID: ${chunk.id}`);
        console.log(`Content: ${chunk.content.substring(0, 150)}...`);
        console.log(`Metadata:`, chunk.metadata);
      });
      console.log('\n🎉 FIX SUCCESSFUL! Knowledge base search is working correctly.');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testRAGSearch();
