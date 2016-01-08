/*
   Copyright 2016 h_ELI_x

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/   

(function(document)
{
    var disableRequireOfDeferedModule = false;
    var globalEval = eval;
    var modules = {};
    
    function getModule(id)
    {
        if (!modules[id])
        {
            modules[id] = new Module(id);
        }
        
        return modules[id];
    }
    
    function Module(id)
    {
        this.state = "initial";
        this.usedDefer = false;
        this.exports = {};
        this.id = id;
        this.source = "";
        this.sourceRequest = null;
        this.requests = [];
        this.error = null;
        
        if (disableRequireOfDeferedModule)
        {
            this.require = function()
            {
                if (this.usedDefer)
                {
                    throw new Error("You are attempting to require a module that should only be loaded with a request.");
                }
                else if (this.state == "loaded")
                {
                    return this.exports;
                }
                else if (this.state == "failed")
                {
                    throw this.error;
                }
                else
                {
                    return this.synchronusStateTransition();
                }
            };
        }
        else
        {
            this.require = function()
            {
                if (this.state == "loaded")
                {
                    return this.exports;
                }
                else if (this.state == "failed")
                {
                    throw this.error;
                }
                else if (this.state == "loading")
                {
                    throw new Error("You are attempting to require a module that is executing a defered load.");
                }
                else
                {
                    return this.synchronusStateTransition();
                }
            };
        }
        
        this.request = function(fulfill, reject)
        {
            this.requests.push({fulfill : fulfill, reject : reject});
            
            if (this.stable())
            {
                this.processRequests();
            }
            else
            {
                return this.asynchronusStateTransition();
            }
        };
        
        this.synchronusStateTransition = function()
        {
            if (this.state == "initial")
            {
                this.acquiringSource();
            }
            
            if (this.sourceRequest)
            {
                this.sourceRequest.onreadystatechange = null;
                this.sourceRequest.abort();
                this.sourceRequest = null;
            }
            
            try
            {
                this.setSource(getSource(this.id));
            }
            catch (error)
            {
                this.fail(error);
                throw error;
            }
            
            this.loadModule();
            
            if (this.state == "loading")
            {
                throw new Error("You are attempting to require a module that is executing a defered load.");
            }
            else if (this.state == "failed")
            {
                throw this.error;
            }
            
            return this.exports;
        };
        
        this.asynchronusStateTransition = function()
        {
            if (this.state == "initial")
            {
                this.acquiringSource();
            }
            
            if (!this.sourceRequest)
            {
                var module = this;
                
                function sourceAvaliable(source)
                {
                    module.setSource(source);
                    module.loadModule();
                }
        
                function sourceUnavaliable(error)
                {
                    module.fail(error);
                }
                
                requestSource(this, sourceAvaliable, sourceUnavaliable);
            }
        };
        
        this.stable = function()
        {
            return ((this.state == "failed") || (this.state == "loaded"));
        };
        
        this.processRequests = function()
        {
            var module = this;
            
            function fulfillRequest(request)
            {
                if (request.fulfill)
                {
                    setTimeout(function(){request.fulfill(module.exports)}, 0);
                }
            }
            
            function rejectRequest(request)
            {
                if (request.reject)
                {
                    setTimeout(function(){request.reject(module.error)}, 0);
                }
            }
            
            if (this.state == "loaded")
            {
                while (this.requests.length > 0)
                {
                    fulfillRequest(this.requests.pop());
                }
            }
            else if (this.state == "failed")
            {
                while (this.requests.length > 0)
                {
                    rejectRequest(this.requests.pop());
                }
            }
        };
        
        this.fail = function(error)
        {
            if (this.stable())
            {
                throw new Error("The module " + id + " is in a stable state and can not go into the failed state.");
            }
            
            this.state = "failed";
            this.error = error;
            this.processRequests();
        };
        
        this.acquiringSource = function(sourceRequest)
        {
            if (this.state != "initial")
            {
                throw new Error("A module can only transition to the acquiring source state from the initial state.");
            }
            
            this.state = "acquiring source";
            this.sourceRequest = sourceRequest;
        };
        
        this.setSource = function(source)
        {
            if (this.state != "acquiring source")
            {
                throw new Error("A module's source can only be set after it has entered the acquiring source state.");
            }
            
            this.state = "sourced";
            this.source = source;
        };
        
        this.loadModule = function()
        {
            if (this.state != "sourced")
            {
                throw new Error("A module can only be loaded after it has entered the sourced state.");
            }
            
            this.state = "loading";
            var module = this;
            var deferCount = 0;
            var perspective = this.id.substring(0, this.id.lastIndexOf("/") + 1);
            
            function require(id)
            {
                return perspectiveRequire(id, perspective);
            }
            
            function request(id, fulfill, reject)
            {
                perspectiveRequest(id, perspective, fulfill, reject);
            }
            
            function defer(resume)
            {
                function callResume()
                {
                    deferCount = deferCount - 1;
                    
                    if (module.state == "loading")
                    {
                        try
                        {
                            resume();
                            
                            if (deferCount == 0)
                            {
                                module.state = "loaded";
                                module.processRequests();
                            }
                        }
                        catch(error)
                        {
                            module.fail(error);
                        }
                    }
                    else
                    {
                        deferCount = 0;
                    }
                }
                
                setTimeout(callResume, 0);
                deferCount = deferCount + 1;
                module.usedDefer = true;
            }
            
            try
            {
                (globalEval("(function(require, request, defer, module, exports){" + this.source + "})"))(require, request, defer, this, this.exports);
                
                if (deferCount == 0)
                {
                    this.state = "loaded";
                    this.processRequests();
                }
            }
            catch(error)
            {
                this.fail(error);
            }
        }
    }
    
    function normalizeID(id, perspective)
    {
        if (id.indexOf("://") != -1)
        {
            return id;
        }
        else
        {
            if (id[0] != "/")
            {
                id = perspective + id
            }
        }
        
        var idParts = id.split("/");
        var idPartsCount = idParts.length;
        var normalizedIDParts = [];

        for(var index = 0;index < idPartsCount;index++)
        {
            if(idParts[index] == ".")
            {
                continue;
            }
            else if(idParts[index] == "..")
            {
                normalizedIDParts.pop();
            }
            else
            {
                normalizedIDParts.push(idParts[index]);
            }
        }

        var normalizedID = "";
        var normalizedIDPartsCount = normalizedIDParts.length;

        for(var index = 0;index < normalizedIDPartsCount;index++)
        {
            if(normalizedIDParts[index] != "")
            {
                normalizedID = normalizedID + "/" + normalizedIDParts[index];
            }
        }

        return normalizedID;
    }

    function getSource(id)
    {
        var moduleRequest = new XMLHttpRequest();
        moduleRequest.open("GET", id + ".js", false);
        moduleRequest.send(null);

        if ((moduleRequest.readyState == XMLHttpRequest.DONE) && (moduleRequest.status == 200))
        {
            return moduleRequest.response;
        }
        else
        {
            throw new Error(moduleRequest.statusText);
        }
    }

    function requestSource(module, fulfill, reject)
    {
        module.sourceRequest = new XMLHttpRequest();
        module.sourceRequest.onreadystatechange = function()
        {
            if (module.sourceRequest.readyState == XMLHttpRequest.DONE)
            {
                if (module.sourceRequest.status == 200)
                {
                    source = module.sourceRequest.response;
                    module.sourceRequest.onreadystatechange = null;
                    module.sourceRequest = null;
                    fulfill(source);
                }
                else
                {
                    statusText = module.sourceRequest.statusText
                    module.sourceRequest.onreadystatechange = null;
                    module.sourceRequest = null;
                    reject(new Error(statusText));
                }
            }
        }
        module.sourceRequest.open("GET", module.id + ".js", true);
        module.sourceRequest.send(null);
    }

    function perspectiveRequire(id, perspective)
    {
        return getModule(normalizeID(id, perspective)).require();
    }

    function perspectiveRequest(id, perspective, fulfill, reject)
    {
        getModule(normalizeID(id, perspective)).request(fulfill, reject);
    }
    
    perspectiveRequest(document.currentScript.dataset.main, "", null, function(error){throw error;});
}(document))