// Google Identity Services type definitions
interface Window {
  google: {
    accounts: {
      id: {
        initialize: (config: any) => void;
        renderButton: (parent: HTMLElement, options: any) => void;
      };
      oauth2: {
        initTokenClient: (config: any) => any;
        initCodeClient: (config: any) => any;
      };
    };
  };
}
