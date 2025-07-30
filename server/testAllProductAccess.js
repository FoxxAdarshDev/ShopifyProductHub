// Test script to understand why we can only access 334 products instead of 1146
const fetch = require('node-fetch');

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

async function testProductAccess() {
  console.log('🧪 Testing different ways to access all 1146 products...');
  
  try {
    // 1. Test products count
    console.log('\n1. Testing product count...');
    const countResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-10/products/count.json`, {
      headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN }
    });
    const countData = await countResponse.json();
    console.log('   Total products:', countData.count);
    
    // 2. Test with different status filters
    console.log('\n2. Testing with different status filters...');
    const statuses = ['active', 'archived', 'draft'];
    let totalFound = 0;
    
    for (const status of statuses) {
      const statusResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-10/products.json?status=${status}&limit=250`, {
        headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN }
      });
      const statusData = await statusResponse.json();
      console.log(`   ${status} products:`, statusData.products?.length || 0);
      totalFound += statusData.products?.length || 0;
    }
    console.log('   Total found with status filters:', totalFound);
    
    // 3. Test with published_status filters
    console.log('\n3. Testing with published_status filters...');
    const publishedStatuses = ['published', 'unpublished'];
    totalFound = 0;
    
    for (const pubStatus of publishedStatuses) {
      const pubResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-10/products.json?published_status=${pubStatus}&limit=250`, {
        headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN }
      });
      const pubData = await pubResponse.json();
      console.log(`   ${pubStatus} products:`, pubData.products?.length || 0);
      totalFound += pubData.products?.length || 0;
    }
    console.log('   Total found with published_status filters:', totalFound);
    
    // 4. Test GraphQL approach
    console.log('\n4. Testing GraphQL approach...');
    const graphqlQuery = `
      query {
        products(first: 250) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              status
              publishedAt
            }
          }
        }
      }
    `;
    
    const graphqlResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: graphqlQuery })
    });
    
    const graphqlData = await graphqlResponse.json();
    console.log('   GraphQL products found:', graphqlData.data?.products?.edges?.length || 0);
    console.log('   Has next page:', graphqlData.data?.products?.pageInfo?.hasNextPage);
    
    // 5. Test very old pagination (if still works)
    console.log('\n5. Testing different API versions...');
    const versions = ['2024-10', '2024-07', '2024-04'];
    
    for (const version of versions) {
      try {
        const versionResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/${version}/products.json?limit=250`, {
          headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN }
        });
        const versionData = await versionResponse.json();
        console.log(`   API ${version}:`, versionData.products?.length || 0, 'products');
      } catch (error) {
        console.log(`   API ${version}: Error -`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAllProductAccess();